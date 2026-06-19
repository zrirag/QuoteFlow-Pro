import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_core.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import Quotation, ClientInfo, LineItem, QuotationTemplate
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

def seed():
    print("Creating users...")
    admin, _ = User.objects.get_or_create(username='admin@quoteflow.pro', defaults={
        'email': 'admin@quoteflow.pro', 'role': 'Admin', 'first_name': 'Admin', 'last_name': 'User'
    })
    admin.set_password('password123')
    admin.is_superuser = True
    admin.is_staff = True
    admin.save()

    manager, _ = User.objects.get_or_create(username='sarah@quoteflow.pro', defaults={
        'email': 'sarah@quoteflow.pro', 'role': 'Manager', 'first_name': 'Sarah', 'last_name': 'Manager'
    })
    manager.set_password('password123')
    manager.save()

    employee, _ = User.objects.get_or_create(username='john@quoteflow.pro', defaults={
        'email': 'john@quoteflow.pro', 'role': 'Employee', 'first_name': 'John', 'last_name': 'Employee'
    })
    employee.set_password('password123')
    employee.save()

    print("Users created successfully.")

    print("Creating sample quotation...")
    if Quotation.objects.count() == 0:
        q = Quotation.objects.create(
            quotationNumber='QF-2026-001',
            issueDate=timezone.now(),
            expiryDate=timezone.now() + timedelta(days=30),
            status='Approved',
            subtotal=50000,
            discountPercent=10,
            gstPercent=18,
            grandTotal=53100,
            createdBy=employee
        )
        ClientInfo.objects.create(
            quotation=q,
            companyName='Acme Corp',
            contactPerson='Jane Doe',
            email='jane@acme.com',
            phone='+1 555-0100',
            address='123 Acme Way, NY'
        )
        LineItem.objects.create(
            quotation=q,
            description='Enterprise Software License',
            quantity=1,
            unitPrice=50000,
            amount=50000
        )
        print("Sample quotation created.")
    else:
        print("Quotations already exist. Skipping.")

    print("Creating sample quotation templates...")
    if QuotationTemplate.objects.count() == 0:
        QuotationTemplate.objects.create(
            name="Software Development Project",
            description="Standard template for bespoke software build including scoping, development, testing, and maintenance.",
            template_json={
                "clientInfo": {
                    "companyName": "Acme Software Corp",
                    "contactPerson": "John Doe",
                    "email": "john@acmesoftware.com",
                    "phone": "+1 555-9876",
                    "address": "456 Tech Ave, Silicon Valley"
                },
                "lineItems": [
                    {"description": "Requirements Gathering & UI Mockups", "quantity": 1, "unitPrice": 5000, "amount": 5000},
                    {"description": "Full-stack Backend & Frontend Development", "quantity": 1, "unitPrice": 35000, "amount": 35000},
                    {"description": "QA, Security Audit & User Acceptance Testing", "quantity": 1, "unitPrice": 5000, "amount": 5000},
                    {"description": "Onboarding & Technical Documentation", "quantity": 1, "unitPrice": 2500, "amount": 2500}
                ],
                "discountPercent": 0,
                "gstPercent": 18
            },
            created_by=admin
        )
        QuotationTemplate.objects.create(
            name="IT Consulting & Advisory Service",
            description="Hourly/Daily rate consulting template for system design, cloud migrations, and general IT auditing.",
            template_json={
                "clientInfo": {
                    "companyName": "Globex Consultancy",
                    "contactPerson": "Alice Smith",
                    "email": "alice@globex.com",
                    "phone": "+1 555-1234",
                    "address": "789 Corporate Blvd, NY"
                },
                "lineItems": [
                    {"description": "Principal Cloud Solution Architect (Days)", "quantity": 10, "unitPrice": 1200, "amount": 12000},
                    {"description": "Senior DevOps Engineering Support (Days)", "quantity": 15, "unitPrice": 800, "amount": 12000},
                    {"description": "System Design Documentation & Strategy Advisory", "quantity": 1, "unitPrice": 3000, "amount": 3000}
                ],
                "discountPercent": 5,
                "gstPercent": 18
            },
            created_by=admin
        )
        QuotationTemplate.objects.create(
            name="SaaS Enterprise Subscription",
            description="Annual/Monthly cloud licensing template with tier-based pricing and premium 24/7 SLA support.",
            template_json={
                "clientInfo": {
                    "companyName": "Stark Industries",
                    "contactPerson": "Pepper Potts",
                    "email": "pepper@stark.com",
                    "phone": "+1 555-3000",
                    "address": "10880 Wilshire Blvd, LA"
                },
                "lineItems": [
                    {"description": "Enterprise Platform User License (Annual Subscription)", "quantity": 100, "unitPrice": 240, "amount": 24000},
                    {"description": "Premium Support Add-on (24/7 Phone & Slack SLA)", "quantity": 1, "unitPrice": 4800, "amount": 4800},
                    {"description": "One-time Setup & Systems Data Migration", "quantity": 1, "unitPrice": 2500, "amount": 2500}
                ],
                "discountPercent": 10,
                "gstPercent": 18
            },
            created_by=admin
        )
        print("Templates created successfully.")
    else:
        print("Templates already exist. Skipping.")

if __name__ == '__main__':
    seed()
