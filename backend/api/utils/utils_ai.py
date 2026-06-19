import logging
from django.utils import timezone
from datetime import datetime
from django.db.models import Avg, Min, Max, Count
from api.models import Quotation, LineItem

logger = logging.getLogger(__name__)

def parse_iso_date(date_str):
    if not date_str:
        return None
    try:
        if isinstance(date_str, datetime):
            return date_str
        # Strip timezone offset if present for simplicity in parse
        if 'T' in date_str:
            date_str = date_str.split('T')[0]
        return datetime.strptime(date_str, "%Y-%m-%d")
    except Exception as e:
        logger.error(f"Error parsing date {date_str}: {e}")
        return None

def analyze_quotation_anomalies(data):
    warnings = []
    
    # 1. Calculation Anomalies
    line_items = data.get('lineItems', [])
    calc_subtotal = 0
    for item in line_items:
        qty = int(item.get('quantity', 1))
        price = float(item.get('unitPrice', 0))
        calc_subtotal += qty * price
        
    subtotal = float(data.get('subtotal', 0))
    discount_percent = float(data.get('discountPercent', 0))
    gst_percent = float(data.get('gstPercent', 0))
    grand_total = float(data.get('grandTotal', 0))
    
    if abs(calc_subtotal - subtotal) > 0.05:
        warnings.append({
            "type": "calculation",
            "message": f"Calculated subtotal of items (${round(calc_subtotal, 2)}) does not match submitted subtotal (${round(subtotal, 2)}).",
            "severity": "error"
        })
        
    # Recalculate grand total
    discount_amount = calc_subtotal * (discount_percent / 100)
    after_discount = calc_subtotal - discount_amount
    gst_amount = after_discount * (gst_percent / 100)
    calc_grand_total = after_discount + gst_amount
    
    if abs(calc_grand_total - grand_total) > 0.05:
        warnings.append({
            "type": "calculation",
            "message": f"Calculated grand total (${round(calc_grand_total, 2)}) does not match submitted grand total (${round(grand_total, 2)}).",
            "severity": "error"
        })

    # 2. Suspicious Pricing (Rule-based historical averages check)
    for item in line_items:
        desc = item.get('description', '').strip()
        price = float(item.get('unitPrice', 0))
        if not desc:
            continue
            
        # Check historical line items with same case-insensitive description
        history = LineItem.objects.filter(description__iexact=desc)
        if history.count() >= 2:
            avg_price = float(history.aggregate(Avg('unitPrice'))['unitPrice__avg'] or 0)
            if avg_price > 0:
                if price < avg_price * 0.5:
                    pct = round((1 - price/avg_price) * 100)
                    warnings.append({
                        "type": "pricing",
                        "message": f"Suspicious Pricing: Unit price for '{desc}' is {pct}% lower than the historical average of ${round(avg_price, 2)}.",
                        "severity": "warning"
                    })
                elif price > avg_price * 2.0:
                    pct = round((price/avg_price - 1) * 100)
                    warnings.append({
                        "type": "pricing",
                        "message": f"Suspicious Pricing: Unit price for '{desc}' is {pct}% higher than the historical average of ${round(avg_price, 2)}.",
                        "severity": "info"
                    })

    # 3. Missing Fields
    client_info = data.get('clientInfo', {})
    company = client_info.get('companyName', '').strip()
    email = client_info.get('email', '').strip()
    phone = client_info.get('phone', '').strip()
    address = client_info.get('address', '').strip()
    
    if not company:
        warnings.append({
            "type": "missing_field",
            "message": "Client details are missing. Company Name is required.",
            "severity": "error"
        })
    if not email:
        warnings.append({
            "type": "missing_field",
            "message": "Client email is missing. Recommendation: Provide email to support public sharing and portal e-signatures.",
            "severity": "info"
        })
    if not phone or not address:
        warnings.append({
            "type": "missing_field",
            "message": "Client phone number or physical address is missing.",
            "severity": "info"
        })

    # 4. Unusual Discounts
    if discount_percent > 20:
        warnings.append({
            "type": "discount",
            "message": f"Unusual Discount: The discount rate of {discount_percent}% is exceptionally high. Standard discount policies recommend caps under 20%. Ensure executive approval exists.",
            "severity": "warning"
        })

    # 5. Expired / Unusual Dates
    issue_date = parse_iso_date(data.get('issueDate'))
    expiry_date = parse_iso_date(data.get('expiryDate'))
    
    if issue_date and expiry_date:
        if expiry_date <= issue_date:
            warnings.append({
                "type": "date",
                "message": "Expirations conflict: Expiry date cannot be on or before the issue date.",
                "severity": "error"
            })
        else:
            duration = (expiry_date - issue_date).days
            if duration > 90:
                warnings.append({
                    "type": "date",
                    "message": f"Long Validity: Quotation is valid for {duration} days. Corporate standards suggest a maximum validity window of 90 days to avoid long-term lock-in.",
                    "severity": "info"
                })
            elif duration < 5:
                warnings.append({
                    "type": "date",
                    "message": f"Short Validity: Quotation is only valid for {duration} days. Clients might need at least 5 business days to process and sign.",
                    "severity": "info"
                })
            
            # Check if expiry is in past
            if expiry_date < datetime.today():
                warnings.append({
                    "type": "date",
                    "message": "Expired: The selected expiry date is in the past.",
                    "severity": "warning"
                })
                
    return warnings

def suggest_cooccurring_items(current_descriptions):
    if not current_descriptions:
        # Provide default standard enterprise upsells if empty
        return [
            {"description": "Premium Support Add-on (24/7 SLA)", "suggestedPrice": 4800.0, "reason": "Recommended service contract for enterprise deployments."},
            {"description": "One-time Setup & Systems Data Migration", "suggestedPrice": 2500.0, "reason": "Commonly requested onboarding support."},
            {"description": "Onboarding & Technical Training Workshop", "suggestedPrice": 1500.0, "reason": "Highly converting service for new installations."}
        ]
        
    cleaned_currents = [d.strip().lower() for d in current_descriptions if d.strip()]
    co_occurrences = {}
    
    # Analyze co-occurrences of items across all historical quotations
    quotes = Quotation.objects.prefetch_related('lineItems')
    for q in quotes:
        items = [i.description.strip() for i in q.lineItems.all()]
        item_lowers = [i.lower() for i in items]
        
        # Check if any of our current items is in this quotation
        has_match = any(curr in item_lowers for curr in cleaned_currents)
        if has_match:
            # Add other items in this quotation as recommendations
            for it in items:
                if it.lower() not in cleaned_currents:
                    co_occurrences[it] = co_occurrences.get(it, 0) + 1
                    
    # Sort co-occurrences by frequency
    sorted_suggs = sorted(co_occurrences.items(), key=lambda x: x[1], reverse=True)
    suggestions = []
    
    for desc, freq in sorted_suggs[:3]:
        # Calculate historical average price
        avg_price = LineItem.objects.filter(description__iexact=desc).aggregate(Avg('unitPrice'))['unitPrice__avg'] or 500.0
        suggestions.append({
            "description": desc,
            "suggestedPrice": float(avg_price),
            "reason": f"Appeared alongside your current items in {freq} historical deal(s)."
        })
        
    # Fill up to 3 with general defaults if we have fewer co-occurrences
    defaults = [
        {"description": "Premium Support Add-on (24/7 SLA)", "suggestedPrice": 4800.0, "reason": "Recommended service contract for enterprise deployments."},
        {"description": "One-time Setup & Systems Data Migration", "suggestedPrice": 2500.0, "reason": "Commonly requested onboarding support."},
        {"description": "Onboarding & Technical Training Workshop", "suggestedPrice": 1500.0, "reason": "Highly converting service for new installations."}
    ]
    
    for d in defaults:
        if len(suggestions) >= 3:
            break
        if not any(s['description'].lower() == d['description'].lower() for s in suggestions) and d['description'].lower() not in cleaned_currents:
            suggestions.append(d)
            
    return suggestions

def get_pricing_recommendation(description):
    desc = description.strip()
    if not desc:
        return None
        
    history = LineItem.objects.filter(description__iexact=desc)
    if history.count() == 0:
        # Fallback to loose contains search
        history = LineItem.objects.filter(description__icontains=desc)
        
    if history.count() > 0:
        aggregate = history.aggregate(
            avg_p=Avg('unitPrice'),
            min_p=Min('unitPrice'),
            max_p=Max('unitPrice'),
            cnt=Count('id')
        )
        return {
            "description": desc,
            "average": float(aggregate['avg_p'] or 0),
            "min": float(aggregate['min_p'] or 0),
            "max": float(aggregate['max_p'] or 0),
            "count": aggregate['cnt']
        }
    return None

def calculate_manager_insights():
    now = timezone.now()
    
    # 1. Follow-up recommendations (Quotations approved but unsigned > 5 days)
    unsigned_approved = Quotation.objects.filter(status='Approved', updatedAt__lte=now - timezone.timedelta(days=5))
    follow_ups = []
    for q in unsigned_approved:
        client_name = q.clientInfo.companyName if hasattr(q, 'clientInfo') else 'N/A'
        days_stale = (now - q.updatedAt).days
        follow_ups.append({
            "id": str(q.id),
            "quotationNumber": q.quotationNumber,
            "client": client_name,
            "daysStale": days_stale,
            "grandTotal": float(q.grandTotal),
            "recommendation": "Quotation approved but unsigned for over 5 days. Recommendation: Resend connection link or call client."
        })
        
    # 2. Revenue Leakage from Discounts
    active_quotes = Quotation.objects.filter(status__in=['Approved', 'Client Signed', 'Paid'])
    total_leakage = 0
    total_subtotal = 0
    discount_sum = 0
    count_quotes = active_quotes.count()
    
    for q in active_quotes:
        sub = float(q.subtotal)
        disc = float(q.discountPercent)
        total_subtotal += sub
        total_leakage += sub * (disc / 100)
        discount_sum += disc
        
    avg_discount = (discount_sum / count_quotes) if count_quotes > 0 else 0
    
    # Let's mock leakage month-over-month increase/decrease based on count
    leakage_trend = "up" if count_quotes > 1 else "stable"
    
    # 3. Conversion Probability Win Estimator
    all_quotes = Quotation.objects.all()
    deals = []
    for q in all_quotes:
        # Rule-based deal win probability
        base_probability = 60
        
        # Check discount
        disc = float(q.discountPercent)
        if disc > 15:
            base_probability += 10
        elif disc > 5:
            base_probability += 5
            
        # Check comments engagement
        if q.comments.count() > 0:
            base_probability += 15
            
        # Check revision requests (indicates active negotiations)
        if q.status == 'Revision Requested':
            base_probability += 5
        elif q.status == 'Client Signed':
            base_probability = 95
        elif q.status == 'Paid':
            base_probability = 100
        elif q.status == 'Rejected':
            base_probability = 10
            
        # Check age
        days_old = (now - q.createdAt).days
        if q.status == 'Approved' and days_old > 14:
            base_probability -= 25 # Deal going stale
            
        # Cap limits
        base_probability = max(5, min(100, base_probability))
        
        client_name = q.clientInfo.companyName if hasattr(q, 'clientInfo') else 'N/A'
        deals.append({
            "id": str(q.id),
            "quotationNumber": q.quotationNumber,
            "client": client_name,
            "status": q.status,
            "grandTotal": float(q.grandTotal),
            "winProbability": base_probability
        })
        
    return {
        "revenueLeakage": {
            "totalLeakage": total_leakage,
            "averageDiscount": avg_discount,
            "trend": leakage_trend
        },
        "followUps": follow_ups[:5], # top 5
        "dealProbabilities": sorted(deals, key=lambda x: x['winProbability'], reverse=True)[:5] # top 5 deals
    }
