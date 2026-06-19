import os
import logging

logger = logging.getLogger(__name__)
import json
from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from .models import Quotation, GoogleDriveIntegration, DocumentHistory
from .utils.pdf_generator import generate_quotation_pdf

# Scopes needed for Google Drive
SCOPES = ['https://www.googleapis.com/auth/drive.file']
CLIENT_SECRETS_FILE = os.path.join(settings.BASE_DIR, "client_secrets.json")

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def drive_auth_url(request):
    """
    Returns the OAuth URL to redirect the user to Google.
    """
    if not os.path.exists(CLIENT_SECRETS_FILE):
        return Response({"detail": "Google Drive Client Secrets not configured. Please add client_secrets.json."}, status=status.HTTP_501_NOT_IMPLEMENTED)
        
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE, scopes=SCOPES)
    
    # Indicate where the API server will redirect the user after the user completes the authorization flow.
    # The redirect URI is required. The value must exactly match one of the authorized redirect URIs for the OAuth 2.0 client.
    flow.redirect_uri = 'http://localhost:8000/api/drive/callback/'

    # Generate URL for request to Google's OAuth 2.0 server.
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Store the state so the callback can verify it (optional but good practice)
    # We can use the user id as state for simplicity in this implementation, 
    # but let's pass a JWT or token later. For now, returning the URL.
    return Response({"url": authorization_url})


@api_view(['GET'])
# We can't easily use IsAuthenticated on a GET callback from Google because the browser sends it.
# So we need to pass a token in the state or rely on session. 
# Alternatively, the frontend handles the callback and sends the code to the backend.
# For simplicity, if the frontend handles it, it sends a POST to exchange the code.
def drive_callback(request):
    """
    Exchange auth code for tokens and save to user's GoogleDriveIntegration.
    """
    return Response({"detail": "Please send POST request with the auth code."})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def drive_exchange_code(request):
    code = request.data.get('code')
    if not code:
        return Response({"detail": "Code is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, scopes=SCOPES)
        flow.redirect_uri = 'http://localhost:8000/api/drive/callback/'
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        integration, created = GoogleDriveIntegration.objects.get_or_create(user=request.user)
        integration.access_token = credentials.token
        if credentials.refresh_token:
            integration.refresh_token = credentials.refresh_token
        integration.save()
        
        return Response({"detail": "Successfully connected to Google Drive."})
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def drive_disconnect(request):
    try:
        integration = GoogleDriveIntegration.objects.get(user=request.user)
        integration.delete()
        return Response({"detail": "Disconnected from Google Drive."})
    except GoogleDriveIntegration.DoesNotExist:
        return Response({"detail": "Not connected."})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def drive_status(request):
    try:
        integration = GoogleDriveIntegration.objects.get(user=request.user)
        return Response({"connected": True, "connected_at": integration.connected_at})
    except GoogleDriveIntegration.DoesNotExist:
        return Response({"connected": False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def drive_upload_pdf(request, pk):
    quotation = get_object_or_404(Quotation, pk=pk)
    try:
        integration = GoogleDriveIntegration.objects.get(user=request.user)
    except GoogleDriveIntegration.DoesNotExist:
        return Response({"detail": "Google Drive is not connected. Please connect your account first."}, status=status.HTTP_400_BAD_REQUEST)
        
    # Set up credentials — use context manager to avoid file handle leaks
    try:
        with open(CLIENT_SECRETS_FILE, 'r') as f:
            client_secrets = json.load(f)
        client_config = client_secrets.get('web', client_secrets.get('installed', {}))
    except (FileNotFoundError, KeyError, json.JSONDecodeError) as e:
        logger.error(f"Failed to read client secrets: {e}")
        return Response({"detail": "Google Drive configuration error."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    credentials = google.oauth2.credentials.Credentials(
        token=integration.access_token,
        refresh_token=integration.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_config.get('client_id'),
        client_secret=client_config.get('client_secret')
    )
    
    try:
        # Generate the PDF
        pdf_buffer = generate_quotation_pdf(quotation)
        
        # Build Drive API service
        service = build('drive', 'v3', credentials=credentials)
        
        # File metadata
        file_metadata = {'name': f'Quotation_{quotation.quotationNumber}.pdf'}
        if integration.folder_id:
            file_metadata['parents'] = [integration.folder_id]
            
        media = MediaIoBaseUpload(pdf_buffer, mimetype='application/pdf', resumable=True)
        
        # Upload
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        # Log to document history
        DocumentHistory.objects.create(
            quotation=quotation,
            user=request.user,
            action=f"PDF uploaded to Drive (ID: {file.get('id')})"
        )
        
        return Response({
            "detail": "Successfully uploaded to Google Drive",
            "file_id": file.get('id')
        })
    except Exception as e:
        return Response({"detail": f"Failed to upload to Google Drive: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
