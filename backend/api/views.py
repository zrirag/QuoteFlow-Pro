from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Quotation, ApprovalHistory, QuotationComment, QuotationViewLog
from .serializers import UserSerializer, QuotationSerializer, ApprovalHistorySerializer, QuotationCommentSerializer, QuotationViewLogSerializer
from .utils import utils_email
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Only admins and managers can list all users
        if user.role in ('Admin', 'Manager'):
            return User.objects.all()
        # Regular users can only see themselves
        return User.objects.filter(pk=user.pk)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class QuotationViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Managers and Admins see all quotations; Employees see only their own
        qs = Quotation.objects.select_related('createdBy', 'clientInfo').prefetch_related(
            'lineItems', 'approval_history', 'comments', 'versions'
        ).order_by('-createdAt')

        if user.role in ('Manager', 'Admin'):
            return qs
        return qs.filter(createdBy=user)

    def perform_create(self, serializer):
        serializer.save(createdBy=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        quotation = self.get_object()
        user = request.user

        if user.role not in ('Manager', 'Admin'):
            return Response({"detail": "Not authorized to approve."}, status=status.HTTP_403_FORBIDDEN)

        if quotation.status not in ('Pending Approval', 'Revision Requested'):
            return Response(
                {"detail": f"Cannot approve a quotation in '{quotation.status}' status."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        quotation.status = 'Approved'
        quotation.save()

        ApprovalHistory.objects.create(
            quotation=quotation,
            user=user,
            status_changed_to='Approved',
            remarks=remarks
        )

        utils_email.notify_quotation_approved(quotation, user, remarks)
        logger.info(f"Quotation {quotation.quotationNumber} approved by {user.username}")

        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quotation = self.get_object()
        user = request.user

        if user.role not in ('Manager', 'Admin'):
            return Response({"detail": "Not authorized to reject."}, status=status.HTTP_403_FORBIDDEN)

        if quotation.status not in ('Pending Approval', 'Revision Requested'):
            return Response(
                {"detail": f"Cannot reject a quotation in '{quotation.status}' status."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        quotation.status = 'Rejected'
        quotation.save()

        ApprovalHistory.objects.create(
            quotation=quotation,
            user=user,
            status_changed_to='Rejected',
            remarks=remarks
        )

        utils_email.notify_quotation_rejected(quotation, user, remarks)
        logger.info(f"Quotation {quotation.quotationNumber} rejected by {user.username}")

        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['post'])
    def submit_approval(self, request, pk=None):
        quotation = self.get_object()
        user = request.user

        # Only the creator or an Admin can submit for approval
        if quotation.createdBy != user and user.role != 'Admin':
            return Response({"detail": "Not authorized to submit this quotation."}, status=status.HTTP_403_FORBIDDEN)

        if quotation.status not in ('Draft', 'Revision Requested', 'Rejected'):
            return Response(
                {"detail": f"Cannot submit a quotation in '{quotation.status}' status for approval."},
                status=status.HTTP_400_BAD_REQUEST
            )

        quotation.status = 'Pending Approval'
        quotation.save()

        ApprovalHistory.objects.create(
            quotation=quotation,
            user=user,
            status_changed_to='Pending Approval',
            remarks='Submitted for manager review.'
        )

        utils_email.notify_submitted_for_approval(quotation)
        logger.info(f"Quotation {quotation.quotationNumber} submitted for approval by {user.username}")

        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        quotation = self.get_object()
        if request.method == 'GET':
            comments = quotation.comments.all().order_by('created_at')
            serializer = QuotationCommentSerializer(comments, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            content = request.data.get('content', '').strip()
            if not content:
                return Response({"detail": "Content is required."}, status=status.HTTP_400_BAD_REQUEST)
            if len(content) > 2000:
                return Response({"detail": "Comment cannot exceed 2000 characters."}, status=status.HTTP_400_BAD_REQUEST)

            comment = QuotationComment.objects.create(
                quotation=quotation,
                user=request.user,
                content=content,
                is_revision_request=False
            )
            serializer = QuotationCommentSerializer(comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def views(self, request, pk=None):
        quotation = self.get_object()
        # Only manager/admin or creator can see view logs
        user = request.user
        if quotation.createdBy != user and user.role not in ('Manager', 'Admin'):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        view_logs = quotation.views.all().order_by('-viewed_at')
        serializer = QuotationViewLogSerializer(view_logs, many=True)
        return Response(serializer.data)


class ApprovalHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('Manager', 'Admin'):
            return ApprovalHistory.objects.all().order_by('-timestamp')
        # Employees only see history for their own quotations
        return ApprovalHistory.objects.filter(
            quotation__createdBy=user
        ).order_by('-timestamp')
