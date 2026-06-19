import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.pdfgen import canvas

def add_watermark(canvas, doc, status):
    """
    Draws a subtle diagonal watermark based on the quotation status.
    """
    canvas.saveState()
    canvas.setFont('Helvetica-Bold', 60)
    
    if status == 'Approved':
        canvas.setFillColorRGB(0, 0.5, 0, alpha=0.1)
        text = "APPROVED"
    elif status == 'Rejected':
        canvas.setFillColorRGB(0.8, 0, 0, alpha=0.1)
        text = "REJECTED"
    elif status == 'Pending Approval':
        canvas.setFillColorRGB(0.8, 0.6, 0, alpha=0.1)
        text = "PENDING APPROVAL"
    else:
        canvas.setFillColorRGB(0.5, 0.5, 0.5, alpha=0.1)
        text = "DRAFT"

    canvas.translate(A4[0] / 2, A4[1] / 2)
    canvas.rotate(45)
    canvas.drawCentredString(0, 0, text)
    canvas.restoreState()


def generate_quotation_pdf(quotation):
    """
    Generates a PDF for a given Quotation instance using ReportLab.
    Returns a BytesIO buffer containing the PDF data.
    """
    buffer = io.BytesIO()
    
    # We use SimpleDocTemplate for layout
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title=f"Quotation {quotation.quotationNumber}"
    )

    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Corporate Styles
    title_style = ParagraphStyle(
        'CorporateTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold', # Professional serif font
        fontSize=24,
        spaceAfter=12,
        textColor=colors.HexColor('#111111')
    )
    
    subtitle_style = ParagraphStyle(
        'CorporateSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        spaceAfter=6,
        textColor=colors.HexColor('#555555')
    )
    
    normal_style = ParagraphStyle(
        'CorporateNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        spaceAfter=2,
        textColor=colors.HexColor('#111111')
    )

    # 1. Header (Logo / Company Info)
    elements.append(Paragraph("QUOTEFLOW PRO", title_style))
    elements.append(Paragraph("123 Financial District, Suite 400<br/>New York, NY 10005<br/>contact@quoteflow.pro", normal_style))
    elements.append(Spacer(1, 0.5*inch))
    
    # 2. Quotation Metadata and Client Info
    meta_data = [
        ["QUOTATION NUMBER", quotation.quotationNumber],
        ["ISSUE DATE", quotation.issueDate.strftime('%B %d, %Y')],
        ["EXPIRY DATE", quotation.expiryDate.strftime('%B %d, %Y')],
    ]
    
    client_info = getattr(quotation, 'clientInfo', None)
    if client_info:
        client_data = [
            ["BILL TO:"],
            [client_info.companyName],
            [client_info.contactPerson],
            [client_info.email],
            [client_info.phone],
            [client_info.address],
        ]
    else:
        client_data = [["BILL TO: N/A"]]

    # We use a 2-column table for header metadata vs client info
    header_table = Table(
        [[
            Table(client_data, style=TableStyle([('FONT', (0,0), (-1,-1), 'Helvetica', 10), ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#111111'))])), 
            Table(meta_data, style=TableStyle([
                ('FONT', (0,0), (0,-1), 'Helvetica-Bold', 10),
                ('FONT', (1,0), (1,-1), 'Helvetica', 10),
                ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
                ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#111111'))
            ]))
        ]],
        colWidths=[A4[0]*0.5 - 2*cm, A4[0]*0.5 - 2*cm]
    )
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # 3. Line Items Table
    line_items_data = [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]]
    
    for item in quotation.lineItems.all():
        line_items_data.append([
            item.description,
            str(item.quantity),
            f"${item.unitPrice:,.2f}",
            f"${item.amount:,.2f}"
        ])
        
    items_table = Table(line_items_data, colWidths=[A4[0]*0.5, 1.5*cm, 3*cm, 3*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8F8F8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#555555')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E5E5')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.25*inch))
    
    # 4. Totals
    # Correct calculation: GST applies on the after-discount amount
    subtotal_val = float(quotation.subtotal)
    discount_val = float(quotation.discountPercent)
    gst_val = float(quotation.gstPercent)
    discount_amount = subtotal_val * (discount_val / 100)
    after_discount = subtotal_val - discount_amount
    gst_amount = after_discount * (gst_val / 100)

    totals_data = [
        ["Subtotal:", f"${subtotal_val:,.2f}"],
        [f"Discount ({discount_val:.1f}%):", f"-${discount_amount:,.2f}"],
        [f"GST ({gst_val:.1f}%):", f"${gst_amount:,.2f}"],
        ["Grand Total:", f"${float(quotation.grandTotal):,.2f}"],
    ]
    
    totals_table = Table(totals_data, colWidths=[A4[0]*0.7, 3*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (0, -2), 'Helvetica'),
        ('FONTNAME', (1, 0), (1, -2), 'Helvetica'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TOPPADDING', (0, -1), (-1, -1), 10),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#111111')),
    ]))
    
    elements.append(totals_table)
    elements.append(Spacer(1, 1*inch))
    
    # 5. Signatures and T&C
    terms = Paragraph(
        "<b>Terms & Conditions</b><br/>"
        "1. This quotation is valid for the period specified above.<br/>"
        "2. Payment is due within 30 days of invoice.<br/>"
        "3. All intellectual property remains the property of QuoteFlow Pro until final payment.<br/>",
        ParagraphStyle('Terms', parent=styles['Normal'], fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#777777'))
    )
    elements.append(terms)
    
    # Helper to draw watermark
    def on_page(canvas, doc):
        add_watermark(canvas, doc, quotation.status)

    doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
    
    buffer.seek(0)
    return buffer
