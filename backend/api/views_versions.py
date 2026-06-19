from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Quotation, QuotationVersion, DocumentHistory
from .serializers import QuotationVersionSerializer, QuotationSerializer
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_versions(request, pk):
    quotation = get_object_or_404(Quotation, pk=pk)

    # Ownership check: only the creator, or manager/admin can view versions
    user = request.user
    if quotation.createdBy != user and user.role not in ('Manager', 'Admin'):
        return Response({"detail": "Not authorized to view versions of this quotation."}, status=status.HTTP_403_FORBIDDEN)

    versions = QuotationVersion.objects.filter(quotation=quotation).order_by('-version_number')
    serializer = QuotationVersionSerializer(versions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_rollback(request, pk, version_number):
    quotation = get_object_or_404(Quotation, pk=pk)

    # Ownership check: only the creator or admin can rollback
    user = request.user
    if quotation.createdBy != user and user.role not in ('Admin',):
        return Response(
            {"detail": "Not authorized to rollback this quotation."},
            status=status.HTTP_403_FORBIDDEN
        )

    # Business rule: cannot rollback a Paid or Client Signed quotation
    if quotation.status in ('Paid', 'Client Signed'):
        return Response(
            {"detail": f"Cannot rollback a quotation in '{quotation.status}' status."},
            status=status.HTTP_400_BAD_REQUEST
        )

    version = get_object_or_404(QuotationVersion, quotation=quotation, version_number=version_number)

    snapshot = version.snapshot_json

    # Prepare data for serializer — only restore content fields, not status/meta
    data = {
        'subtotal': snapshot.get('subtotal'),
        'discountPercent': snapshot.get('discountPercent'),
        'gstPercent': snapshot.get('gstPercent'),
        'grandTotal': snapshot.get('grandTotal'),
        'clientInfo': snapshot.get('clientInfo'),
        'lineItems': snapshot.get('lineItems'),
    }

    serializer = QuotationSerializer(quotation, data=data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()

        DocumentHistory.objects.create(
            quotation=quotation,
            user=request.user,
            action=f"Rolled back to version {version_number}"
        )

        logger.info(f"Quotation {quotation.quotationNumber} rolled back to v{version_number} by {user.username}")
        return Response(serializer.data)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
