from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Quotation, ClientInfo, LineItem, QuotationVersion, QuotationTemplate
from django.utils import timezone
from datetime import timedelta
import json

User = get_user_model()

class Phase4Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='password123', role='Employee')
        self.client.force_authenticate(user=self.user)
        
        self.quotation = Quotation.objects.create(
            quotationNumber='TEST-001',
            issueDate=timezone.now(),
            expiryDate=timezone.now() + timedelta(days=30),
            status='Draft',
            createdBy=self.user
        )
        ClientInfo.objects.create(quotation=self.quotation, companyName='Test Corp')
        LineItem.objects.create(quotation=self.quotation, description='Item 1', quantity=1, unitPrice=100, amount=100)

    def test_pdf_export(self):
        url = reverse('export_pdf', args=[self.quotation.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_excel_export(self):
        url = reverse('export_excel')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    def test_csv_export(self):
        url = reverse('export_csv')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')

    def test_quotation_versioning(self):
        # Update quotation to trigger version creation via API
        url = reverse('quotation-detail', args=[self.quotation.id])
        data = {
            'quotationNumber': 'TEST-001-UPDATED',
            'status': 'Draft',
            'clientInfo': {'companyName': 'Test Corp Updated'},
            'lineItems': [{'description': 'Item 1 Updated', 'quantity': 2, 'unitPrice': 100, 'amount': 200}],
            'subtotal': 200,
            'discountPercent': 0,
            'gstPercent': 0,
            'grandTotal': 200,
            'issueDate': timezone.now().isoformat(),
            'expiryDate': (timezone.now() + timedelta(days=30)).isoformat()
        }
        
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        versions = QuotationVersion.objects.filter(quotation=self.quotation)
        self.assertTrue(versions.count() >= 1)
        
        # Test rollback
        latest_version = versions.order_by('-version_number').first()
        rollback_url = reverse('quotation_rollback', args=[self.quotation.id, latest_version.version_number])
        rollback_response = self.client.post(rollback_url)
        self.assertEqual(rollback_response.status_code, status.HTTP_200_OK)


class Phase5Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='password123', role='Employee')
        
        self.quotation = Quotation.objects.create(
            quotationNumber='TEST-002',
            issueDate=timezone.now(),
            expiryDate=timezone.now() + timedelta(days=30),
            status='Approved',
            createdBy=self.user
        )
        ClientInfo.objects.create(quotation=self.quotation, companyName='Client Corp')
        LineItem.objects.create(quotation=self.quotation, description='Product A', quantity=1, unitPrice=500, amount=500)

    def test_public_get_quotation(self):
        url = reverse('public_get_quotation', args=[self.quotation.id]) + f"?token={self.quotation.client_access_token}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['quotationNumber'], 'TEST-002')
        self.assertEqual(self.quotation.views.count(), 1) # View Log created

    def test_public_get_quotation_expired(self):
        self.quotation.client_link_expires_at = timezone.now() - timedelta(days=1)
        self.quotation.save()
        url = reverse('public_get_quotation', args=[self.quotation.id]) + f"?token={self.quotation.client_access_token}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_410_GONE)

    def test_public_sign_quotation(self):
        url = reverse('public_sign_quotation', args=[self.quotation.id]) + f"?token={self.quotation.client_access_token}"
        data = {
            'name': 'Client Signer',
            'email': 'signer@client.com',
            'signature_data': 'data:image/png;base64,mocksignaturedata'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Client Signed')
        self.assertEqual(response.data['signed_by_name'], 'Client Signer')

    def test_public_comments_and_revision(self):
        url = reverse('public_comments', args=[self.quotation.id]) + f"?token={self.quotation.client_access_token}"
        
        # Test post comment
        data = {
            'name': 'Client Representative',
            'content': 'Please discount the price.',
            'is_revision_request': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'Please discount the price.')
        
        # Verify status changed to Revision Requested
        self.quotation.refresh_from_db()
        self.assertEqual(self.quotation.status, 'Revision Requested')

    def test_public_payment_confirm(self):
        # Set status to Client Signed first (prerequisite for payment)
        self.quotation.status = 'Client Signed'
        self.quotation.save()
        
        url = reverse('public_pay_confirm', args=[self.quotation.id]) + f"?token={self.quotation.client_access_token}"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Paid')
        self.assertEqual(response.data['payment_status'], 'Paid')


class Phase2AITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.employee = User.objects.create_user(username='emp', password='password123', role='Employee')
        self.manager = User.objects.create_user(username='mgr', password='password123', role='Manager')
        self.client.force_authenticate(user=self.employee)
        
        # Seed some template data
        self.template = QuotationTemplate.objects.create(
            name='Test Template',
            description='Template description',
            template_json={
                "lineItems": [{"description": "Cloud Hosting", "quantity": 1, "unitPrice": 500.0}],
                "discountPercent": 10.0,
                "gstPercent": 18.0
            }
        )

        # Seed some historical line items to test average calculations
        self.quot1 = Quotation.objects.create(
            quotationNumber='HIST-001', 
            issueDate=timezone.now(),
            expiryDate=timezone.now() + timedelta(days=30),
            createdBy=self.employee, 
            status='Approved'
        )
        ClientInfo.objects.create(quotation=self.quot1, companyName='Hist 1')
        LineItem.objects.create(quotation=self.quot1, description='Consulting Hour', quantity=5, unitPrice=200.0, amount=1000.0)
        LineItem.objects.create(quotation=self.quot1, description='Setup Service', quantity=1, unitPrice=500.0, amount=500.0)

        self.quot2 = Quotation.objects.create(
            quotationNumber='HIST-002', 
            issueDate=timezone.now(),
            expiryDate=timezone.now() + timedelta(days=30),
            createdBy=self.employee, 
            status='Paid'
        )
        ClientInfo.objects.create(quotation=self.quot2, companyName='Hist 2')
        LineItem.objects.create(quotation=self.quot2, description='Consulting Hour', quantity=10, unitPrice=200.0, amount=2000.0)
        LineItem.objects.create(quotation=self.quot2, description='Support SLA', quantity=1, unitPrice=150.0, amount=150.0)

    def test_analyze_quotation_warnings(self):
        url = reverse('ai_analyze')
        data = {
            'issueDate': '2026-06-01',
            'expiryDate': '2026-06-30',
            'discountPercent': 25.0, # Flagged (>20%)
            'gstPercent': 18.0,
            'subtotal': 1000.0,
            'grandTotal': 500.0, # Math check mismatch
            'clientInfo': {
                'companyName': '', # Missing Name error
                'email': 'client@test.com'
            },
            'lineItems': [
                {'description': 'Consulting Hour', 'quantity': 5, 'unitPrice': 50.0} # Suspicious Pricing: historical is 200, 50 is < 50% avg
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        warnings = response.data
        
        warn_types = [w['type'] for w in warnings]
        self.assertIn('discount', warn_types)
        self.assertIn('calculation', warn_types)
        self.assertIn('missing_field', warn_types)
        self.assertIn('pricing', warn_types)

    def test_suggest_items_endpoint(self):
        url = reverse('ai_suggest_items')
        data = {'descriptions': ['Consulting Hour']}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 3)
        self.assertIn('description', response.data[0])
        self.assertIn('suggestedPrice', response.data[0])

    def test_price_recommendation_endpoint(self):
        url = reverse('ai_price_recommendations') + "?description=Consulting Hour"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['average'], 200.0)
        self.assertEqual(response.data['min'], 200.0)
        self.assertEqual(response.data['max'], 200.0)
        self.assertEqual(response.data['count'], 2)

        url_none = reverse('ai_price_recommendations') + "?description=NonExistentService"
        response_none = self.client.get(url_none)
        self.assertEqual(response_none.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_insights_permission_and_data(self):
        url = reverse('ai_manager_insights')
        
        self.client.force_authenticate(user=self.employee)
        response_emp = self.client.get(url)
        self.assertEqual(response_emp.status_code, status.HTTP_403_FORBIDDEN)
        
        self.client.force_authenticate(user=self.manager)
        response_mgr = self.client.get(url)
        self.assertEqual(response_mgr.status_code, status.HTTP_200_OK)
        self.assertIn('revenueLeakage', response_mgr.data)
        self.assertIn('followUps', response_mgr.data)
        self.assertIn('dealProbabilities', response_mgr.data)

    def test_template_crud(self):
        url = reverse('quotationtemplate-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Test Template')


