from rest_framework import serializers
from .models import User, Quotation, ClientInfo, LineItem, ApprovalHistory, GoogleDriveIntegration, DocumentHistory, QuotationVersion, QuotationComment, QuotationViewLog
from django.db.models import Max

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name']


class ClientInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientInfo
        fields = ['companyName', 'contactPerson', 'email', 'phone', 'address']


class LineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineItem
        fields = ['id', 'description', 'quantity', 'unitPrice', 'amount']


class QuotationSerializer(serializers.ModelSerializer):
    clientInfo = ClientInfoSerializer()
    lineItems = LineItemSerializer(many=True)
    createdBy = UserSerializer(read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'quotationNumber', 'issueDate', 'expiryDate', 'status',
            'clientInfo', 'lineItems', 'subtotal', 'discountPercent',
            'gstPercent', 'grandTotal', 'createdBy', 'createdAt', 'updatedAt',
            'client_access_token', 'client_link_expires_at',
            'signed_by_name', 'signed_by_email', 'signed_at', 'signature_data',
            'payment_status', 'paid_at'
        ]

    def create(self, validated_data):
        client_info_data = validated_data.pop('clientInfo')
        line_items_data = validated_data.pop('lineItems')
        
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['createdBy'] = request.user

        quotation = Quotation.objects.create(**validated_data)
        
        ClientInfo.objects.create(quotation=quotation, **client_info_data)
        
        for item_data in line_items_data:
            LineItem.objects.create(quotation=quotation, **item_data)
            
        # Create initial version snapshot
        snapshot_data = QuotationSerializer(quotation).data
        QuotationVersion.objects.create(
            quotation=quotation,
            version_number=1,
            snapshot_json=snapshot_data,
            created_by=request.user if request and hasattr(request, 'user') else None
        )
            
        return quotation

    def update(self, instance, validated_data):
        client_info_data = validated_data.pop('clientInfo', None)
        line_items_data = validated_data.pop('lineItems', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if client_info_data:
            client_info = instance.clientInfo
            for attr, value in client_info_data.items():
                setattr(client_info, attr, value)
            client_info.save()

        if line_items_data is not None:
            instance.lineItems.all().delete()
            for item_data in line_items_data:
                LineItem.objects.create(quotation=instance, **item_data)

        # Create new version snapshot
        snapshot_data = QuotationSerializer(instance).data
        request = self.context.get('request')
        max_v = QuotationVersion.objects.filter(quotation=instance).aggregate(Max('version_number'))['version_number__max'] or 0
        QuotationVersion.objects.create(
            quotation=instance,
            version_number=max_v + 1,
            snapshot_json=snapshot_data,
            created_by=request.user if request and hasattr(request, 'user') else None
        )

        return instance


class ApprovalHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ApprovalHistory
        fields = ['id', 'quotation', 'user', 'status_changed_to', 'remarks', 'timestamp']


class GoogleDriveIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleDriveIntegration
        fields = ['folder_id', 'connected_at']


class DocumentHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = DocumentHistory
        fields = ['id', 'quotation', 'user', 'action', 'timestamp']


class QuotationVersionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = QuotationVersion
        fields = ['id', 'quotation', 'version_number', 'snapshot_json', 'created_by', 'created_at']


class QuotationCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = QuotationComment
        fields = ['id', 'quotation', 'user', 'client_name', 'content', 'is_revision_request', 'created_at']


class QuotationViewLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationViewLog
        fields = ['id', 'quotation', 'ip_address', 'user_agent', 'viewed_at']
