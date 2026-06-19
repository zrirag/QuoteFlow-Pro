from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.throttling import AnonRateThrottle
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .models import Quotation, QuotationComment, QuotationViewLog, ApprovalHistory
from .serializers import QuotationSerializer, QuotationCommentSerializer
from .utils import utils_email
import logging
import html

logger = logging.getLogger(__name__)

# Max signature data size: ~500KB base64 encoded
MAX_SIGNATURE_DATA_SIZE = 512 * 1024
# Max comment length
MAX_COMMENT_LENGTH = 2000
# Max name field length
MAX_NAME_LENGTH = 255


def sanitize_text(text: str) -> str:
    """Basic XSS prevention — escape HTML entities."""
    return html.escape(text.strip())


def verify_token_and_get_quote(pk, token):
    if not token:
        return None, Response({"detail": "Access token is required."}, status=status.HTTP_403_FORBIDDEN)
    try:
        quotation = Quotation.objects.select_related('createdBy', 'clientInfo').prefetch_related(
            'lineItems', 'comments', 'approval_history'
        ).get(pk=pk)
    except (Quotation.DoesNotExist, ValueError):
        return None, Response({"detail": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

    if str(quotation.client_access_token) != token:
        logger.warning(f"Invalid token attempt for quotation {pk}")
        return None, Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)

    if timezone.now() > quotation.client_link_expires_at:
        return None, Response({"detail": "Access link has expired.", "expired": True}, status=status.HTTP_410_GONE)

    return quotation, None


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_get_quotation(request, pk):
    token = request.query_params.get('token', '')
    quotation, err_response = verify_token_and_get_quote(pk, token)
    if err_response:
        return err_response

    # Log the view — get real IP (handle proxies safely)
    ip_raw = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'Unknown'))
    ip_address = ip_raw.split(',')[0].strip()[:50]  # Truncate to field max_length
    user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')[:500]  # Reasonable limit

    QuotationViewLog.objects.create(
        quotation=quotation,
        ip_address=ip_address,
        user_agent=user_agent
    )

    serializer = QuotationSerializer(quotation)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def public_sign_quotation(request, pk):
    token = request.query_params.get('token', '')
    quotation, err_response = verify_token_and_get_quote(pk, token)
    if err_response:
        return err_response

    # Business rule: Quotation must be approved before signing
    if quotation.status != 'Approved':
        return Response(
            {"detail": "Quotation cannot be signed unless it is in Approved status."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Prevent double-signing
    if quotation.signed_at is not None:
        return Response(
            {"detail": "This quotation has already been signed."},
            status=status.HTTP_409_CONFLICT
        )

    name = sanitize_text(request.data.get('name', ''))
    email = sanitize_text(request.data.get('email', ''))
    signature_data = request.data.get('signature_data', '').strip()

    # Required field validation
    if not name or not email or not signature_data:
        return Response(
            {"detail": "Name, email, and signature drawing are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Length limits
    if len(name) > MAX_NAME_LENGTH:
        return Response({"detail": "Name field is too long."}, status=status.HTTP_400_BAD_REQUEST)

    # Email format validation
    try:
        validate_email(email)
    except ValidationError:
        return Response({"detail": "A valid email address is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Signature size guard — base64 encoded PNG should be reasonable
    if len(signature_data) > MAX_SIGNATURE_DATA_SIZE:
        return Response({"detail": "Signature data is too large."}, status=status.HTTP_400_BAD_REQUEST)

    # Ensure signature_data is a valid data URL
    if not signature_data.startswith('data:image/'):
        return Response({"detail": "Invalid signature format."}, status=status.HTTP_400_BAD_REQUEST)

    # Update quotation
    quotation.status = 'Client Signed'
    quotation.signed_by_name = name
    quotation.signed_by_email = email
    quotation.signed_at = timezone.now()
    quotation.signature_data = signature_data
    quotation.save()

    # Audit log
    ApprovalHistory.objects.create(
        quotation=quotation,
        user=None,
        status_changed_to='Client Signed',
        remarks=f"Signed by client: {name} ({email})"
    )

    logger.info(f"Quotation {quotation.quotationNumber} signed by client '{name}' ({email})")
    utils_email.notify_client_signed(quotation)

    serializer = QuotationSerializer(quotation)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def public_comments(request, pk):
    token = request.query_params.get('token', '')
    quotation, err_response = verify_token_and_get_quote(pk, token)
    if err_response:
        return err_response

    if request.method == 'GET':
        comments = quotation.comments.all().order_by('created_at')
        serializer = QuotationCommentSerializer(comments, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        name_raw = request.data.get('name', '').strip() or 'Client'
        content_raw = request.data.get('content', '').strip()
        is_revision_request = bool(request.data.get('is_revision_request', False))

        # Sanitize inputs
        name = sanitize_text(name_raw)[:MAX_NAME_LENGTH]
        content = sanitize_text(content_raw)

        if not content:
            return Response({"detail": "Comment content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        if len(content) > MAX_COMMENT_LENGTH:
            return Response(
                {"detail": f"Comment cannot exceed {MAX_COMMENT_LENGTH} characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        comment = QuotationComment.objects.create(
            quotation=quotation,
            user=None,
            client_name=name,
            content=content,
            is_revision_request=is_revision_request
        )

        if is_revision_request:
            # Only update status if currently Approved or Client Signed
            if quotation.status in ('Approved',):
                quotation.status = 'Revision Requested'
                quotation.save()

                ApprovalHistory.objects.create(
                    quotation=quotation,
                    user=None,
                    status_changed_to='Revision Requested',
                    remarks=f"Revision requested by client: {name}"
                )

        logger.info(f"New client comment on quotation {quotation.quotationNumber} from '{name}'")
        utils_email.notify_client_comment(quotation, comment)

        serializer = QuotationCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def public_pay(request, pk):
    token = request.query_params.get('token', '')
    quotation, err_response = verify_token_and_get_quote(pk, token)
    if err_response:
        return err_response

    # Business rule: Can only pay if client has signed
    if quotation.status != 'Client Signed':
        return Response(
            {"detail": "Quotation must be signed before initiating payment."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Mock Stripe Checkout session
    return Response({
        "checkout_session_id": f"mock_session_{quotation.id}",
        "amount": str(quotation.grandTotal),
        "currency": "usd"
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def public_pay_confirm(request, pk):
    token = request.query_params.get('token', '')
    quotation, err_response = verify_token_and_get_quote(pk, token)
    if err_response:
        return err_response

    # Guard: must be Client Signed (not already paid)
    if quotation.status == 'Paid':
        return Response({"detail": "This quotation has already been paid."}, status=status.HTTP_409_CONFLICT)

    if quotation.status != 'Client Signed':
        return Response(
            {"detail": "Quotation must be signed before paying."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Complete the mock payment
    quotation.status = 'Paid'
    quotation.payment_status = 'Paid'
    quotation.paid_at = timezone.now()
    quotation.save()

    ApprovalHistory.objects.create(
        quotation=quotation,
        user=None,
        status_changed_to='Paid',
        remarks="Invoice paid successfully via mock Stripe integration."
    )

    logger.info(f"Quotation {quotation.quotationNumber} marked as Paid")
    utils_email.notify_client_paid(quotation)

    serializer = QuotationSerializer(quotation)
    return Response(serializer.data)
