from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.utils import timezone
from datetime import timedelta

def get_default_link_expiry():
    return timezone.now() + timedelta(days=30)


class User(AbstractUser):
    ROLE_CHOICES = (
        ('Employee', 'Employee'),
        ('Manager', 'Manager'),
        ('Admin', 'Admin'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Employee')
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class Quotation(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Pending Approval', 'Pending Approval'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Revision Requested', 'Revision Requested'),
        ('Client Signed', 'Client Signed'),
        ('Paid', 'Paid'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotationNumber = models.CharField(max_length=100, unique=True)
    issueDate = models.DateTimeField()
    expiryDate = models.DateTimeField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    
    # Client sharing & security
    client_access_token = models.UUIDField(default=uuid.uuid4, db_index=True, null=True, blank=True)
    client_link_expires_at = models.DateTimeField(default=get_default_link_expiry)
    
    # Signature details
    signed_by_name = models.CharField(max_length=255, blank=True, null=True)
    signed_by_email = models.EmailField(blank=True, null=True)
    signed_at = models.DateTimeField(blank=True, null=True)
    signature_data = models.TextField(blank=True, null=True)
    
    # Payment status
    payment_status = models.CharField(max_length=20, default='Unpaid', choices=(('Unpaid', 'Unpaid'), ('Paid', 'Paid')))
    paid_at = models.DateTimeField(blank=True, null=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discountPercent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gstPercent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grandTotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    createdBy = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='quotations')
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.quotationNumber


class ClientInfo(models.Model):
    quotation = models.OneToOneField(Quotation, on_delete=models.CASCADE, related_name='clientInfo')
    companyName = models.CharField(max_length=255)
    contactPerson = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return f"{self.companyName} for {self.quotation.quotationNumber}"


class LineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='lineItems')
    description = models.CharField(max_length=500)
    quantity = models.IntegerField(default=1)
    unitPrice = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return self.description


class ApprovalHistory(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='approval_history')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    status_changed_to = models.CharField(max_length=50)
    remarks = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.quotation.quotationNumber} -> {self.status_changed_to}"


class GoogleDriveIntegration(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='drive_integration')
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, null=True)
    folder_id = models.CharField(max_length=255, blank=True, null=True)
    connected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Drive Integration: {self.user.username}"


class DocumentHistory(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='document_history')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)  # e.g. 'PDF generated', 'PDF uploaded to Drive'
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.quotation.quotationNumber} - {self.action} at {self.timestamp}"


class QuotationVersion(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    snapshot_json = models.JSONField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('quotation', 'version_number')

    def __str__(self):
        return f"{self.quotation.quotationNumber} - v{self.version_number}"


class QuotationComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    client_name = models.CharField(max_length=255, blank=True, null=True)
    content = models.TextField()
    is_revision_request = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        author = self.user.username if self.user else (self.client_name or 'Client')
        return f"Comment by {author} on {self.quotation.quotationNumber}"


class QuotationViewLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='views')
    ip_address = models.CharField(max_length=50)
    user_agent = models.TextField()
    viewed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Viewed {self.quotation.quotationNumber} from {self.ip_address} at {self.viewed_at}"


class QuotationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    template_json = models.JSONField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='templates')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
