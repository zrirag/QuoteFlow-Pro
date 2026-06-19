import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { Quotation, LineItem } from '../types';
import { CorpButton } from '../components/ui/CorpButton';
import { CorpInput } from '../components/ui/CorpInput';
import { Badge } from '../components/ui/Badge';

export const SharePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const { fetchPublicQuotation, signPublicQuotation, fetchPublicComments, postPublicComment, payPublicQuotation, confirmPublicPayment } = useStore();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Comments state
  const [clientName, setClientName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [isRevision, setIsRevision] = useState<boolean>(false);

  // Modals state
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);

  // Signing inputs
  const [signerName, setSignerName] = useState<string>('');
  const [signerEmail, setSignerEmail] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Payment inputs
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');
  const [paying, setPaying] = useState<boolean>(false);
  const [cardErrors, setCardErrors] = useState<{ number?: string; expiry?: string; cvc?: string }>({});

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    setCardNumber(parts.join(' '));
    setCardErrors(prev => ({ ...prev, number: undefined }));
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setCardExpiry(formatted);
    setCardErrors(prev => ({ ...prev, expiry: undefined }));
  };

  const handleCardCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setCardCvc(digits);
    setCardErrors(prev => ({ ...prev, cvc: undefined }));
  };

  const loadData = async () => {
    if (!id || !token) {
      setError('Quotation ID and Token are required.');
      setLoading(false);
      return;
    }
    try {
      const q = await fetchPublicQuotation(id, token);
      setQuotation(q);
      const cms = await fetchPublicComments(id, token);
      setComments(cms);
    } catch (err: any) {
      if (err.response?.status === 410 || err.response?.data?.expired) {
        setIsExpired(true);
      } else {
        setError(err.response?.data?.detail || 'Failed to load quotation.');
      }
    } finally {
      setLoading(false);
    }
  };

  const pollData = async () => {
    if (!id || !token) return;
    try {
      const q = await fetchPublicQuotation(id, token);
      setQuotation(q);
      const cms = await fetchPublicComments(id, token);
      setComments(cms);
    } catch (err) {
      console.error("Polling error in client portal", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(pollData, 8000); // 8s polling to reduce server load
    return () => clearInterval(interval);
  }, [id, token]);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !token || !commentText.trim()) return;

    const nameToPost = clientName.trim() || 'Client';
    const res = await postPublicComment(id, token, nameToPost, commentText, isRevision);
    if (res) {
      setCommentText('');
      setIsRevision(false);
      // Reload quote to show status update
      loadData();
    }
  };

  const handleSignSubmit = async () => {
    if (!id || !token) return;
    if (!signerName.trim() || !signerEmail.trim()) {
      alert('Please enter your name and email.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if signature canvas is blank (all pixels are transparent)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some((channel, index) => index % 4 === 3 && channel > 0);
      if (!hasContent) {
        alert('Please draw your signature before submitting.');
        return;
      }
    }

    const signatureData = canvas.toDataURL('image/png');

    try {
      const updatedQ = await signPublicQuotation(id, token, signerName, signerEmail, signatureData);
      if (updatedQ) {
        setQuotation(updatedQ);
        setShowSignModal(false);
        loadData();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit signature.');
    }
  };

  const handlePaymentSubmit = async () => {
    if (!id || !token) return;

    // Validate inputs
    const errors: { number?: string; expiry?: string; cvc?: string } = {};
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    if (!cleanedNumber) {
      errors.number = 'Card number is required.';
    } else if (!/^\d{16}$/.test(cleanedNumber)) {
      errors.number = 'Card number must be exactly 16 digits.';
    }

    if (!cardExpiry) {
      errors.expiry = 'Expiration date is required.';
    } else if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      errors.expiry = 'Use MM/YY format.';
    } else {
      const [mStr, yStr] = cardExpiry.split('/');
      const month = parseInt(mStr, 10);
      const year = parseInt(yStr, 10) + 2000;
      if (month < 1 || month > 12) {
        errors.expiry = 'Invalid month.';
      } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
          errors.expiry = 'Card has expired.';
        }
      }
    }

    if (!cardCvc) {
      errors.cvc = 'CVC is required.';
    } else if (!/^\d{3,4}$/.test(cardCvc)) {
      errors.cvc = 'Must be 3 or 4 digits.';
    }

    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }

    setPaying(true);
    try {
      // Step 1: Initiate payment intent with mock Stripe
      await payPublicQuotation(id, token);
      // Step 2: Confirm mock payment
      const updatedQ = await confirmPublicPayment(id, token);
      if (updatedQ) {
        setQuotation(updatedQ);
        setShowPayModal(false);
        setCardNumber('');
        setCardExpiry('');
        setCardCvc('');
        setCardErrors({});
        loadData();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-corp-bg flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-corp-text mx-auto"></div>
          <p className="mt-4 text-corp-text text-sm font-medium">Securing connection to Client Portal...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-corp-bg flex items-center justify-center font-sans px-4">
        <div className="max-w-md w-full bg-white border border-red-200 p-8 text-center shadow-lg rounded-sm">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif text-corp-text font-semibold mb-2">Access Link Expired</h1>
          <p className="text-corp-text-sec text-sm leading-relaxed mb-6">
            For security reasons, this quotation share link has expired. Share links are valid for 30 days. Please reach out to your account representative to request a renewed link.
          </p>
          <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            QuoteFlow Pro Security Operations
          </div>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-corp-bg flex items-center justify-center font-sans px-4">
        <div className="max-w-md w-full bg-white border border-corp-border p-8 text-center shadow-lg rounded-sm">
          <h1 className="text-xl font-serif text-corp-text font-semibold mb-2">Quotation Unavailable</h1>
          <p className="text-corp-text-sec text-sm mb-6">{error || 'This quotation could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-corp-bg flex flex-col font-sans">
      
      {/* Client Portal Header */}
      <header className="bg-corp-text text-white py-4 px-6 flex justify-between items-center shadow-md border-b border-black">
        <div className="flex items-center gap-4">
          <span className="font-serif text-xl tracking-tight font-bold">QuoteFlow Pro</span>
          <span className="text-xs font-semibold px-2 py-0.5 bg-gray-700 text-gray-200 uppercase tracking-wider rounded-sm">Client Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={
            quotation.status === 'Approved' ? 'success' : 
            quotation.status === 'Client Signed' ? 'warning' : 
            quotation.status === 'Paid' ? 'neutral' : 'neutral'
          }>{quotation.status}</Badge>
          
          {quotation.status === 'Approved' && (
            <button className="bg-white text-black hover:bg-gray-100 px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer" onClick={() => setShowSignModal(true)}>
              Accept & Sign
            </button>
          )}

          {quotation.status === 'Client Signed' && (
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors cursor-pointer animate-pulse" onClick={() => setShowPayModal(true)}>
              Pay Invoice
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-[1800px]">
        
        {/* LEFT 3 COLS: Preview document */}
        <div className="lg:col-span-3 flex justify-center items-start">
          <div className="bg-white shadow-xl border border-gray-200 w-full max-w-[850px] min-h-[1100px] p-12 flex flex-col relative overflow-hidden">
            
            {/* Real-time Diagonal Watermark */}
            {(quotation.status === 'Draft' || quotation.status === 'Pending Approval' || quotation.status === 'Revision Requested' || quotation.status === 'Client Signed' || quotation.status === 'Paid') && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.04]">
                <span className="text-8xl font-black uppercase tracking-widest rotate-[-45deg] whitespace-nowrap">
                  {quotation.status}
                </span>
              </div>
            )}

            {/* Document Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-corp-text pb-8 mb-8 gap-4 sm:gap-0">
              <div>
                <h1 className="text-4xl font-serif font-bold text-corp-text tracking-tight">QuoteFlow Pro</h1>
                <p className="text-corp-text-sec mt-2 text-sm">123 Corporate Blvd, Suite 400<br/>New York, NY 10001<br/>contact@quoteflow.pro</p>
              </div>
              <div className="sm:text-right">
                <h2 className="text-3xl font-light text-corp-text-muted mb-3 tracking-widest uppercase">Quotation</h2>
                <p className="text-corp-text text-sm mb-1"><strong className="text-gray-500 font-medium">Quote Number:</strong> <span className="font-medium">{quotation.quotationNumber}</span></p>
                <p className="text-corp-text text-sm mb-1"><strong className="text-gray-500 font-medium">Issue Date:</strong> {new Date(quotation.issueDate).toLocaleDateString()}</p>
                <p className="text-corp-text text-sm"><strong className="text-gray-500 font-medium">Valid Until:</strong> {new Date(quotation.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Client Info */}
            <div className="mb-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-corp-text-sec mb-3">Prepared For</h3>
              <p className="text-2xl text-corp-text font-serif font-medium mb-1">{quotation.clientInfo?.companyName || 'Client Name'}</p>
              {quotation.clientInfo?.contactPerson && <p className="text-sm text-corp-text mb-1">Attn: {quotation.clientInfo.contactPerson}</p>}
              {quotation.clientInfo?.address && <p className="text-sm text-corp-text-sec mb-1 whitespace-pre-wrap">{quotation.clientInfo.address}</p>}
              {(quotation.clientInfo?.email || quotation.clientInfo?.phone) && (
                <p className="text-sm text-corp-text-sec">{[quotation.clientInfo.email, quotation.clientInfo.phone].filter(Boolean).join(' | ')}</p>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto mb-10">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b-2 border-corp-text bg-gray-50/50">
                    <th className="py-3 px-2 text-left font-bold text-corp-text uppercase tracking-wider text-xs">Description</th>
                    <th className="py-3 px-2 text-center font-bold text-corp-text uppercase tracking-wider text-xs w-20">Qty</th>
                    <th className="py-3 px-2 text-right font-bold text-corp-text uppercase tracking-wider text-xs w-32">Unit Price</th>
                    <th className="py-3 px-2 text-right font-bold text-corp-text uppercase tracking-wider text-xs w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.lineItems?.map((item: LineItem) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-4 px-2 text-corp-text text-sm">{item.description}</td>
                      <td className="py-4 px-2 text-center text-corp-text text-sm">{item.quantity}</td>
                      <td className="py-4 px-2 text-right text-corp-text text-sm">${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="py-4 px-2 text-right text-corp-text text-sm font-medium">${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & E-Signature Displays */}
            <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div>
                {quotation.signed_by_name ? (
                  <div className="border border-corp-border p-4 bg-gray-50 rounded-sm">
                    <h4 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-2">Accepted & Digitally Signed</h4>
                    <p className="text-sm text-corp-text font-medium">{quotation.signed_by_name}</p>
                    <p className="text-xs text-corp-text-sec">{quotation.signed_by_email}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Signed at: {new Date(quotation.signed_at!).toLocaleString()}</p>
                    {quotation.signature_data && (
                      <div className="mt-2 border-t border-gray-200 pt-2 flex justify-center">
                        <img src={quotation.signature_data} alt="Client Signature" className="max-h-16 object-contain" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 p-4 flex flex-col justify-center items-center text-center rounded-sm bg-gray-50/50 min-h-[120px]">
                    <span className="text-xs text-corp-text-sec">Awaiting Client E-Signature</span>
                    {quotation.status === 'Approved' && (
                      <button onClick={() => setShowSignModal(true)} className="mt-2 text-xs font-semibold text-corp-accent hover:underline">
                        Click here to Sign
                      </button>
                    )}
                  </div>
                )}
                
                {quotation.payment_status === 'Paid' && (
                  <div className="mt-4 border border-green-200 bg-green-50/50 p-4 flex items-center gap-3 rounded-sm">
                    <span className="h-2 w-2 rounded-full bg-green-600"></span>
                    <div>
                      <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Payment Received</p>
                      <p className="text-[10px] text-green-700">Invoice settled on {new Date(quotation.paid_at!).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-xs bg-gray-50/50 p-4 border border-gray-100 self-start">
                  <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                    <span>Subtotal</span>
                    <span>${quotation.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  {quotation.discountPercent > 0 && (
                    <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                      <span>Discount ({quotation.discountPercent}%)</span>
                      <span className="text-red-600">-${(quotation.subtotal * (quotation.discountPercent / 100)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  )}
                  {quotation.gstPercent > 0 && (
                    <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                      <span>Tax ({quotation.gstPercent}%)</span>
                      <span>${((quotation.subtotal - (quotation.subtotal * (quotation.discountPercent / 100))) * (quotation.gstPercent / 100)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 text-lg font-bold text-corp-text border-t-2 border-corp-text mt-2">
                    <span>Total</span>
                    <span>${quotation.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer / Terms */}
            <div className="pt-8 border-t border-gray-200 mt-auto">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-corp-text-sec mb-2">Terms & Conditions</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Payment is due within 30 days of quotation acceptance. This quotation is valid until the specified expiry date.
                All amounts are in USD unless otherwise specified.
              </p>
            </div>

          </div>
        </div>

        {/* RIGHT 1 COL: Client comments & revision panel */}
        <div className="lg:col-span-1 bg-white border border-corp-border p-6 flex flex-col h-full lg:sticky lg:top-[80px] max-h-[calc(100vh-120px)] shadow-sm">
          <h3 className="text-sm font-bold text-corp-text uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Client Portal Chat</h3>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-corp-text-muted italic">No comments posted yet. Start the conversation below.</p>
            ) : (
              comments.map((c: any) => (
                <div key={c.id} className={`p-3 rounded-sm border ${c.is_revision_request ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-corp-text">
                      {c.user ? `${c.user.username} (Staff)` : (c.client_name || 'Client')}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-corp-text-sec leading-relaxed">{c.content}</p>
                  {c.is_revision_request && (
                    <span className="mt-1 inline-block text-[9px] font-bold text-red-600 bg-red-100/50 px-1 rounded-sm">
                      ⚠️ Revision Request
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handlePostComment} className="space-y-3 pt-3 border-t border-corp-border shrink-0">
            <CorpInput 
              label="Your Name" 
              placeholder="e.g. John Doe" 
              value={clientName} 
              onChange={e => setClientName(e.target.value)} 
            />
            <div>
              <label className="block text-xs font-semibold text-corp-text-sec uppercase tracking-wider mb-1">Comment</label>
              <textarea 
                className="w-full text-xs p-2 border border-corp-border focus:border-corp-text outline-none resize-none font-sans" 
                rows={3} 
                placeholder="Type your feedback..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
            </div>

            {quotation.status === 'Approved' && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input 
                  type="checkbox" 
                  checked={isRevision} 
                  onChange={e => setIsRevision(e.target.checked)}
                  className="rounded border-gray-300 text-corp-text focus:ring-corp-text" 
                />
                <span className="text-xs text-red-600 font-semibold uppercase tracking-wider">Request Revision</span>
              </label>
            )}

            <CorpButton className="w-full text-xs py-1.5" type="submit">Send Message</CorpButton>
          </form>
        </div>

      </div>

      {/* MODAL 1: ACCEPT & SIGN */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-corp-border max-w-lg w-full p-6 shadow-2xl space-y-6 rounded-sm">
            <div className="flex justify-between items-center border-b border-corp-border pb-3">
              <h3 className="text-lg font-serif font-bold text-corp-text">Review & Digitally Sign</h3>
              <button className="text-gray-400 hover:text-black text-xl" onClick={() => setShowSignModal(false)}>&times;</button>
            </div>
            
            <div className="space-y-4">
              <CorpInput label="Full Name (Signer)" value={signerName} onChange={e => setSignerName(e.target.value)} />
              <CorpInput label="Email Address" type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} />
              
              <div>
                <label className="block text-xs font-semibold text-corp-text-sec uppercase tracking-wider mb-2">Draw Your Signature</label>
                <div className="border border-corp-border bg-gray-50 rounded-sm overflow-hidden">
                  <canvas 
                    ref={canvasRef} 
                    width={460} 
                    height={160} 
                    className="w-full bg-white cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-gray-400">Draw with your mouse, trackpad, or finger.</span>
                  <button type="button" className="text-xs text-corp-accent font-semibold hover:underline" onClick={clearCanvas}>Clear Signature</button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-corp-border justify-end">
              <CorpButton variant="secondary" className="px-4 py-1.5 text-xs" onClick={() => setShowSignModal(false)}>Cancel</CorpButton>
              <CorpButton className="px-4 py-1.5 text-xs" onClick={handleSignSubmit}>Submit Signature</CorpButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MOCK STRIPE CHECKOUT */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-corp-border max-w-md w-full p-6 shadow-2xl space-y-6 rounded-sm">
            <div className="flex justify-between items-center border-b border-corp-border pb-3">
              <h3 className="text-lg font-serif font-bold text-corp-text">Stripe Checkout</h3>
              <button className="text-gray-400 hover:text-black text-xl" onClick={() => setShowPayModal(false)}>&times;</button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 border border-gray-100 text-center">
                <span className="text-xs text-corp-text-sec uppercase tracking-wider">Total Amount Due</span>
                <p className="text-2xl font-bold text-corp-text mt-1">${quotation.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>

              <CorpInput 
                label="Card Number" 
                placeholder="4242 4242 4242 4242" 
                value={cardNumber} 
                onChange={handleCardNumberChange} 
                error={cardErrors.number}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <CorpInput 
                  label="Expires" 
                  placeholder="MM/YY" 
                  value={cardExpiry} 
                  onChange={handleCardExpiryChange} 
                  error={cardErrors.expiry}
                />
                <CorpInput 
                  label="CVC" 
                  placeholder="123" 
                  value={cardCvc} 
                  onChange={handleCardCvcChange} 
                  error={cardErrors.cvc}
                />
              </div>

              <div className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>SSL Encrypted Connection. Secured by Stripe Sandboxed.</span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-corp-border justify-end">
              <CorpButton variant="secondary" className="px-4 py-1.5 text-xs" onClick={() => setShowPayModal(false)}>Cancel</CorpButton>
              <CorpButton className="px-6 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent" onClick={handlePaymentSubmit} disabled={paying}>
                {paying ? 'Processing...' : 'Pay Invoice'}
              </CorpButton>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
