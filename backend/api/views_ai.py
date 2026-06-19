from rest_framework import status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from django.utils import timezone
from .models import QuotationTemplate, User
from .serializers import QuotationSerializer
from .utils import utils_ai
from rest_framework.serializers import ModelSerializer

# Simple serializer for QuotationTemplate
class QuotationTemplateSerializer(ModelSerializer):
    class Meta:
        model = QuotationTemplate
        fields = ['id', 'name', 'description', 'template_json', 'created_at']

class QuotationTemplateViewSet(viewsets.ModelViewSet):
    queryset = QuotationTemplate.objects.all().order_by('name')
    serializer_class = QuotationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def public_analyze(request):
    """
    Analyzes an unsaved quotation draft payload for warnings, errors, and pricing anomalies.
    """
    warnings = utils_ai.analyze_quotation_anomalies(request.data)
    return Response(warnings)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def suggest_items(request):
    """
    Suggests co-occurring line items based on currently added item descriptions.
    """
    descriptions = request.data.get('descriptions', [])
    suggestions = utils_ai.suggest_cooccurring_items(descriptions)
    return Response(suggestions)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def price_recommendations(request):
    """
    Looks up average unit prices for a specific line item description.
    """
    description = request.query_params.get('description', '').strip()
    if not description:
        return Response({"detail": "Description query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        
    recommendation = utils_ai.get_pricing_recommendation(description)
    if recommendation:
        return Response(recommendation)
    return Response({"detail": "No pricing history found for this description."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def manager_insights(request):
    """
    Generates manager-level insights feed for deals, conversion odds, and leakage metrics.
    """
    user = request.user
    if user.role != 'Manager' and user.role != 'Admin':
        return Response({"detail": "Only managers or admins can access insights."}, status=status.HTTP_403_FORBIDDEN)
        
    insights = utils_ai.calculate_manager_insights()
    return Response(insights)
