from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_quotationtemplate'),
    ]

    operations = [
        # Add composite and individual indexes for common query patterns
        migrations.AddIndex(
            model_name='quotation',
            index=models.Index(fields=['status'], name='api_quotation_status_idx'),
        ),
        migrations.AddIndex(
            model_name='quotation',
            index=models.Index(fields=['createdAt'], name='api_quotation_createdat_idx'),
        ),
        migrations.AddIndex(
            model_name='quotation',
            index=models.Index(fields=['payment_status'], name='api_quotation_payment_idx'),
        ),
        migrations.AddIndex(
            model_name='quotation',
            index=models.Index(fields=['expiryDate'], name='api_quotation_expiry_idx'),
        ),
        # Composite index for common filter: status + createdBy
        migrations.AddIndex(
            model_name='quotation',
            index=models.Index(fields=['status', 'createdBy'], name='api_quotation_status_creator_idx'),
        ),
        # Index for comment lookups
        migrations.AddIndex(
            model_name='quotationcomment',
            index=models.Index(fields=['quotation', 'created_at'], name='api_comment_quote_time_idx'),
        ),
        # Index for view log lookups
        migrations.AddIndex(
            model_name='quotationviewlog',
            index=models.Index(fields=['quotation', 'viewed_at'], name='api_viewlog_quote_time_idx'),
        ),
        # Index for approval history lookups
        migrations.AddIndex(
            model_name='approvalhistory',
            index=models.Index(fields=['quotation', 'timestamp'], name='api_approval_quote_time_idx'),
        ),
        # Index for version lookups
        migrations.AddIndex(
            model_name='quotationversion',
            index=models.Index(fields=['quotation', 'version_number'], name='api_version_quote_num_idx'),
        ),
    ]
