from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import UserViewSet, QuotationViewSet, ApprovalHistoryViewSet
from .views_export import export_quotation_pdf, export_excel, export_csv
from .views_drive import drive_auth_url, drive_callback, drive_exchange_code, drive_disconnect, drive_status, drive_upload_pdf
from .views_versions import quotation_versions, quotation_rollback
from .views_public import public_get_quotation, public_sign_quotation, public_comments, public_pay, public_pay_confirm
from .views_ai import QuotationTemplateViewSet, public_analyze, suggest_items, price_recommendations, manager_insights

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'approvals', ApprovalHistoryViewSet, basename='approvalhistory')
router.register(r'templates', QuotationTemplateViewSet, basename='quotationtemplate')

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Export endpoints
    path('quotations/<uuid:pk>/pdf/', export_quotation_pdf, name='export_pdf'),
    path('quotations/export/excel/', export_excel, name='export_excel'),
    path('quotations/export/csv/', export_csv, name='export_csv'),
    
    # Versioning endpoints
    path('quotations/<uuid:pk>/versions/', quotation_versions, name='quotation_versions'),
    path('quotations/<uuid:pk>/versions/<int:version_number>/rollback/', quotation_rollback, name='quotation_rollback'),
    
    # Google Drive endpoints
    path('drive/auth/', drive_auth_url, name='drive_auth_url'),
    path('drive/callback/', drive_callback, name='drive_callback'),
    path('drive/exchange/', drive_exchange_code, name='drive_exchange'),
    path('drive/disconnect/', drive_disconnect, name='drive_disconnect'),
    path('drive/status/', drive_status, name='drive_status'),
    path('quotations/<uuid:pk>/drive/upload/', drive_upload_pdf, name='drive_upload'),
    
    # Public Client Portal endpoints
    path('public/quotations/<uuid:pk>/', public_get_quotation, name='public_get_quotation'),
    path('public/quotations/<uuid:pk>/sign/', public_sign_quotation, name='public_sign_quotation'),
    path('public/quotations/<uuid:pk>/comments/', public_comments, name='public_comments'),
    path('public/quotations/<uuid:pk>/pay/', public_pay, name='public_pay'),
    path('public/quotations/<uuid:pk>/pay-confirm/', public_pay_confirm, name='public_pay_confirm'),
    
    # AI Feature endpoints
    path('ai/analyze/', public_analyze, name='ai_analyze'),
    path('ai/suggest-items/', suggest_items, name='ai_suggest_items'),
    path('ai/price-recommendation/', price_recommendations, name='ai_price_recommendations'),
    path('ai/insights/', manager_insights, name='ai_manager_insights'),
    
    path('', include(router.urls)),
]
