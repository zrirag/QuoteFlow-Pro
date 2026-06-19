from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)

def send_notification_email(subject, message, recipient_list):
    # filter out empty emails
    recipients = [email for email in recipient_list if email]
    if not recipients:
        logger.warning(f"No valid recipients for email: {subject}")
        return
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@quoteflow.pro')
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipients,
            fail_silently=False,
        )
        logger.info(f"Notification email sent: '{subject}' to {recipients}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

def notify_submitted_for_approval(quotation):
    User = get_user_model()
    managers = User.objects.filter(role='Manager', is_active=True)
    manager_emails = list(managers.values_list('email', flat=True))
    
    subject = f"[QuoteFlow Pro] Review Required: Quotation {quotation.quotationNumber}"
    message = f"""Hello,

Quotation {quotation.quotationNumber} has been submitted for review and approval by {quotation.createdBy.username if quotation.createdBy else 'an employee'}.

Details:
- Quotation Number: {quotation.quotationNumber}
- Client: {quotation.clientInfo.companyName if hasattr(quotation, 'clientInfo') else 'N/A'}
- Grand Total: ${quotation.grandTotal}

Please log in to the QuoteFlow Pro dashboard to approve or reject this quotation.

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, manager_emails)

def notify_quotation_approved(quotation, manager_user, remarks):
    if not quotation.createdBy or not quotation.createdBy.email:
        return
    subject = f"[QuoteFlow Pro] Quotation Approved: {quotation.quotationNumber}"
    message = f"""Hello {quotation.createdBy.username},

Your quotation {quotation.quotationNumber} has been APPROVED by manager {manager_user.username}.

Remarks: {remarks or 'None'}

You can now share this quotation link with the client:
http://localhost:5173/share/{quotation.id}?token={quotation.client_access_token}

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, [quotation.createdBy.email])

def notify_quotation_rejected(quotation, manager_user, remarks):
    if not quotation.createdBy or not quotation.createdBy.email:
        return
    subject = f"[QuoteFlow Pro] Quotation Rejected: {quotation.quotationNumber}"
    message = f"""Hello {quotation.createdBy.username},

Your quotation {quotation.quotationNumber} has been REJECTED by manager {manager_user.username}.

Remarks: {remarks or 'None'}

Please review the feedback and update the quotation draft.

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, [quotation.createdBy.email])

def notify_client_comment(quotation, comment):
    recipients = []
    if quotation.createdBy and quotation.createdBy.email:
        recipients.append(quotation.createdBy.email)
        
    # Also notify managers who might be tracking the deal
    User = get_user_model()
    managers = User.objects.filter(role='Manager', is_active=True)
    recipients.extend(list(managers.values_list('email', flat=True)))
    
    author = comment.user.username if comment.user else (comment.client_name or 'Client')
    type_str = "Revision Request" if comment.is_revision_request else "Comment"
    
    subject = f"[QuoteFlow Pro] New Client {type_str} on Quotation {quotation.quotationNumber}"
    message = f"""Hello,

{author} has posted a new {type_str.lower()} on Quotation {quotation.quotationNumber}.

Comment:
"{comment.content}"

View Quotation Link:
http://localhost:5173/builder?id={quotation.id}

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, recipients)

def notify_client_signed(quotation):
    recipients = []
    if quotation.createdBy and quotation.createdBy.email:
        recipients.append(quotation.createdBy.email)
    
    User = get_user_model()
    managers = User.objects.filter(role='Manager', is_active=True)
    recipients.extend(list(managers.values_list('email', flat=True)))
    
    subject = f"[QuoteFlow Pro] Quotation SIGNED by Client: {quotation.quotationNumber}"
    message = f"""Hello,

Quotation {quotation.quotationNumber} has been accepted and digitally signed by the client!

Signer Info:
- Name: {quotation.signed_by_name}
- Email: {quotation.signed_by_email}
- Signed At: {quotation.signed_at}

Payment Status: {quotation.payment_status}

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, recipients)

def notify_client_paid(quotation):
    recipients = []
    if quotation.createdBy and quotation.createdBy.email:
        recipients.append(quotation.createdBy.email)
    
    User = get_user_model()
    managers = User.objects.filter(role='Manager', is_active=True)
    recipients.extend(list(managers.values_list('email', flat=True)))
    
    subject = f"[QuoteFlow Pro] Quotation PAID: {quotation.quotationNumber}"
    message = f"""Hello,

Quotation {quotation.quotationNumber} has been fully PAID!

Payment Info:
- Total Paid: ${quotation.grandTotal}
- Paid At: {quotation.paid_at}

Regards,
QuoteFlow Pro System
"""
    send_notification_email(subject, message, recipients)
