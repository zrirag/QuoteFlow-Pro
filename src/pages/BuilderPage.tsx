import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopNavigation } from '../components/layout/TopNavigation';
import { CorpInput } from '../components/ui/CorpInput';
import { CorpButton } from '../components/ui/CorpButton';
import { useStore } from '../store/useStore';
import type { Quotation, LineItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '../components/ui/Badge';
import { ApprovalTimeline } from '../components/quotations/ApprovalTimeline';

const DEFAULT_GST = 18;

export const BuilderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const { 
    quotations, 
    addQuotation, 
    updateQuotation, 
    currentUser, 
    addNotification,
    templates,
    fetchTemplates,
    analyzeQuotation,
    fetchItemSuggestions,
    fetchPriceRecommendation
  } = useStore();

  const existingQuotation = id ? quotations.find(q => q.id === id) : null;

  const [companyName, setCompanyName] = useState(existingQuotation?.clientInfo.companyName || '');
  const [contactPerson, setContactPerson] = useState(existingQuotation?.clientInfo.contactPerson || '');
  const [email, setEmail] = useState(existingQuotation?.clientInfo.email || '');
  const [phone, setPhone] = useState(existingQuotation?.clientInfo.phone || '');
  const [address, setAddress] = useState(existingQuotation?.clientInfo.address || '');

  const [quotationNumber, setQuotationNumber] = useState(existingQuotation?.quotationNumber || `QF-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  const [issueDate, setIssueDate] = useState(existingQuotation?.issueDate.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(existingQuotation?.expiryDate.split('T')[0] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const [items, setItems] = useState<LineItem[]>(existingQuotation?.lineItems || [
    { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  
  const [discountPercent, setDiscountPercent] = useState(existingQuotation?.discountPercent || 0);
  const [gstPercent, setGstPercent] = useState(existingQuotation?.gstPercent || DEFAULT_GST);

  const [comments, setComments] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  const [newComment, setNewComment] = useState<string>('');

  // AI intelligence states
  const [warnings, setWarnings] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [priceRecs, setPriceRecs] = useState<Record<string, any>>({});

  // Auto calculations
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const gstAmount = afterDiscount * (gstPercent / 100);
  const grandTotal = afterDiscount + gstAmount;

  const loadCommentsAndLogs = async () => {
    if (existingQuotation) {
      const cms = await useStore.getState().fetchInternalComments(existingQuotation.id);
      setComments(cms);
      const logs = await useStore.getState().fetchViewLogs(existingQuotation.id);
      setViewLogs(logs);
    }
  };

  const isLoadedRef = useRef(false);

  // Fetch quotations and templates on mount
  useEffect(() => {
    useStore.getState().fetchQuotations();
    fetchTemplates();
  }, []);

  // Template selection handler
  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const data = template.template_json;
    if (data.lineItems) {
      setItems(data.lineItems.map(item => ({
        id: uuidv4(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice
      })));
    }
    if (typeof data.discountPercent === 'number') {
      setDiscountPercent(data.discountPercent);
    }
    if (typeof data.gstPercent === 'number') {
      setGstPercent(data.gstPercent);
    }
    addNotification({
      title: 'Template Applied',
      message: `Successfully loaded items from template: "${template.name}"`,
      type: 'success'
    });
  };

  // Debounced AI warning panel analysis
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      const payload = {
        issueDate,
        expiryDate,
        discountPercent,
        gstPercent,
        subtotal,
        grandTotal,
        clientInfo: {
          companyName,
          contactPerson,
          email,
          phone,
          address
        },
        lineItems: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };
      
      const res = await analyzeQuotation(payload);
      setWarnings(res);
    }, 600);

    return () => clearTimeout(debounceTimer);
  }, [
    items.map(i => `${i.description}-${i.quantity}-${i.unitPrice}`).join('|'),
    discountPercent,
    gstPercent,
    companyName,
    email,
    phone,
    address,
    issueDate,
    expiryDate,
    subtotal,
    grandTotal
  ]);

  // Debounced co-occurring add-on suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      const descriptions = items.map(i => i.description).filter(d => d.trim().length > 0);
      const res = await fetchItemSuggestions(descriptions);
      setSuggestions(res);
    };
    
    const debounceTimer = setTimeout(fetchSuggestions, 800);
    return () => clearTimeout(debounceTimer);
  }, [items.map(i => i.description).join('|')]);

  // Debounced price guidelines caching
  useEffect(() => {
    const fetchRecsForItems = async () => {
      const uniqueDescs = Array.from(new Set(items.map(i => i.description.trim()).filter(d => d.length >= 3)));
      for (const desc of uniqueDescs) {
        if (!priceRecs[desc.toLowerCase()]) {
          try {
            const rec = await fetchPriceRecommendation(desc);
            if (rec) {
              setPriceRecs(prev => ({
                ...prev,
                [desc.toLowerCase()]: rec
              }));
            }
          } catch (e) {
            // Ignore if lookup fails
          }
        }
      }
    };

    const timer = setTimeout(fetchRecsForItems, 1000);
    return () => clearTimeout(timer);
  }, [items.map(i => i.description).join('|')]);

  // Reset loaded ref when ID changes
  useEffect(() => {
    isLoadedRef.current = false;
  }, [id]);

  // Sync quotation details to React state once loaded
  useEffect(() => {
    if (existingQuotation && !isLoadedRef.current) {
      setCompanyName(existingQuotation.clientInfo?.companyName || '');
      setContactPerson(existingQuotation.clientInfo?.contactPerson || '');
      setEmail(existingQuotation.clientInfo?.email || '');
      setPhone(existingQuotation.clientInfo?.phone || '');
      setAddress(existingQuotation.clientInfo?.address || '');
      setQuotationNumber(existingQuotation.quotationNumber || '');
      setIssueDate(existingQuotation.issueDate.split('T')[0] || '');
      setExpiryDate(existingQuotation.expiryDate.split('T')[0] || '');
      setItems(existingQuotation.lineItems || []);
      setDiscountPercent(Number(existingQuotation.discountPercent) || 0);
      setGstPercent(Number(existingQuotation.gstPercent) || DEFAULT_GST);
      isLoadedRef.current = true;
    }
  }, [existingQuotation]);

  // Real-time polling for comments, logs, and status
  useEffect(() => {
    loadCommentsAndLogs();
    
    const interval = setInterval(async () => {
      if (existingQuotation) {
        try {
          // 1. Poll comments list
          const cms = await useStore.getState().fetchInternalComments(existingQuotation.id);
          setComments(prev => {
            if (cms.length > prev.length) {
              const latest = cms[cms.length - 1];
              if (!latest.user) {
                addNotification({
                  title: 'New Client Comment',
                  message: `Client comment: "${latest.content}"`,
                  type: 'info'
                });
              }
            }
            return cms;
          });

          // 2. Poll view logs
          const logs = await useStore.getState().fetchViewLogs(existingQuotation.id);
          setViewLogs(logs);

          // 3. Poll general store quotations status
          await useStore.getState().fetchQuotations();
        } catch (err) {
          console.error("Polling error in BuilderPage", err);
        }
      }
    }, 8000); // 8s polling: reduces server load while still providing near-real-time updates

    return () => clearInterval(interval);
  }, [existingQuotation?.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingQuotation || !newComment.trim()) return;
    const res = await useStore.getState().postInternalComment(existingQuotation.id, newComment);
    if (res) {
      setNewComment('');
      loadCommentsAndLogs();
    }
  };

  // Auto Calculations
  useEffect(() => {
    setItems(prevItems => prevItems.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice
    })));
  }, [items.map(i => i.quantity).join(), items.map(i => i.unitPrice).join()]); // Only re-run when qty or price changes



  const handleAddItem = () => {
    setItems([...items, { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = async (submitForApproval: boolean = false) => {
    if (!currentUser) return;

    const isEmployee = currentUser.role === 'Employee';
    const targetStatus = submitForApproval 
      ? (isEmployee ? 'Pending Approval' : 'Approved') 
      : (existingQuotation?.status || 'Draft');

    const newQuotation: Partial<Quotation> = {
      id: existingQuotation?.id,
      quotationNumber,
      issueDate: new Date(issueDate).toISOString(),
      expiryDate: new Date(expiryDate).toISOString(),
      status: targetStatus,
      clientInfo: { companyName, contactPerson, email, phone, address },
      lineItems: items,
      subtotal,
      discountPercent,
      gstPercent,
      grandTotal,
    };

    let savedQuote: Quotation | null = null;
    if (existingQuotation) {
      savedQuote = await updateQuotation(existingQuotation.id, newQuotation);
      if (savedQuote) {
        addNotification({ title: 'Quotation Updated', message: `Quote ${quotationNumber} updated successfully.`, type: 'success' });
      }
    } else {
      savedQuote = await addQuotation(newQuotation);
      if (savedQuote) {
        addNotification({ title: 'Quotation Created', message: `Quote ${quotationNumber} created successfully.`, type: 'success' });
      }
    }

    if (savedQuote && submitForApproval) {
      if (isEmployee) {
        await useStore.getState().submitForApproval(savedQuote.id);
      } else {
        await useStore.getState().submitForApproval(savedQuote.id);
        await useStore.getState().approveQuotation(savedQuote.id, 'Self-approved by creator manager/admin.');
      }
    }

    if (savedQuote && !existingQuotation) {
      navigate(`/builder?id=${savedQuote.id}`, { replace: true });
    }
  };

  const handleManagerAction = async (action: 'Approved' | 'Rejected') => {
    if (!existingQuotation) return;
    if (action === 'Approved') {
        await useStore.getState().approveQuotation(existingQuotation.id, '');
    } else {
        await useStore.getState().rejectQuotation(existingQuotation.id, '');
    }
    addNotification({ title: `Quotation ${action}`, message: `Quote ${quotationNumber} has been ${action.toLowerCase()}.`, type: action === 'Approved' ? 'success' : 'error' });
  };

  // Mock timeline steps
  const mockSteps = useMemo(() => {
    if (!existingQuotation) return [];
    const steps: Array<{ status: any; date: string; user: string }> = [
      { status: 'Draft', date: existingQuotation.createdAt, user: 'System' }
    ];
    if (existingQuotation.status === 'Pending Approval' || existingQuotation.status === 'Approved' || existingQuotation.status === 'Rejected' || existingQuotation.status === 'Revision Requested' || existingQuotation.status === 'Client Signed' || existingQuotation.status === 'Paid') {
      steps.push({ status: 'Pending Approval', date: existingQuotation.updatedAt, user: 'Employee' });
    }
    if (existingQuotation.status === 'Approved' || existingQuotation.status === 'Revision Requested' || existingQuotation.status === 'Client Signed' || existingQuotation.status === 'Paid') {
      steps.push({ status: 'Approved', date: existingQuotation.updatedAt, user: 'Manager' });
    } else if (existingQuotation.status === 'Rejected') {
      steps.push({ status: 'Rejected', date: existingQuotation.updatedAt, user: 'Manager' });
    }
    if (existingQuotation.status === 'Revision Requested') {
      steps.push({ status: 'Revision Requested', date: existingQuotation.updatedAt, user: 'Client' });
    }
    if (existingQuotation.status === 'Client Signed' || existingQuotation.status === 'Paid') {
      steps.push({ status: 'Client Signed', date: existingQuotation.updatedAt, user: 'Client' });
    }
    if (existingQuotation.status === 'Paid') {
      steps.push({ status: 'Paid', date: existingQuotation.updatedAt, user: 'Client' });
    }
    return steps;
  }, [existingQuotation]);

  return (
    <div className="min-h-screen bg-corp-bg flex flex-col font-sans">
      <TopNavigation />
      
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1800px]">
        
        {/* LEFT PANEL: Builder Form */}
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif text-corp-text font-semibold">
                {existingQuotation ? 'Edit Quotation' : 'New Quotation'}
              </h1>
              {existingQuotation && (
                <Badge variant={
                  existingQuotation.status === 'Draft' ? 'neutral' : 
                  existingQuotation.status === 'Approved' ? 'success' : 
                  existingQuotation.status === 'Rejected' ? 'error' : 'warning'
                }>{existingQuotation.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {existingQuotation && (
                <CorpButton 
                  variant="secondary" 
                  className="px-4 py-1.5 text-xs bg-white text-corp-text hover:bg-gray-50 border-gray-300"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${existingQuotation.id}?token=${existingQuotation.client_access_token}`;
                    navigator.clipboard.writeText(shareUrl);
                    addNotification({ title: 'Link Copied', message: 'Client share link copied to clipboard.', type: 'success' });
                  }}
                >
                  Copy Client Link
                </CorpButton>
              )}
              <CorpButton variant="secondary" className="px-4 py-1.5 text-xs" onClick={() => handleSave(false)}>Save Draft</CorpButton>
              {existingQuotation?.status !== 'Pending Approval' && existingQuotation?.status !== 'Approved' && (
                <CorpButton className="px-4 py-1.5 text-xs" onClick={() => handleSave(true)}>
                  {currentUser?.role === 'Employee' ? 'Submit for Approval' : 'Approve & Publish'}
                </CorpButton>
              )}
            </div>
          </div>

          {/* Live AI Alerts Panel */}
          {warnings.length > 0 && (
            <div className="bg-white border border-corp-border p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-corp-border pb-2">
                <span className="text-xs font-bold text-corp-text uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  AI Quality Auditor
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-black text-white rounded-sm">{warnings.length} alert(s)</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {warnings.map((warn, index) => {
                  let alertClass = "border-gray-200 bg-gray-50/50 text-corp-text";
                  let prefix = "💡 Info: ";
                  if (warn.severity === 'error') {
                    alertClass = "border-red-300 bg-red-50/30 text-red-950";
                    prefix = "🔴 Error: ";
                  } else if (warn.severity === 'warning') {
                    alertClass = "border-amber-300 bg-amber-50/30 text-amber-950";
                    prefix = "⚠️ Warning: ";
                  }
                  return (
                    <div key={index} className={`p-2.5 border text-xs font-mono leading-relaxed rounded-sm ${alertClass}`}>
                      <span className="font-bold">{prefix}</span>
                      {warn.message}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-corp-border p-6 space-y-8 shadow-sm">
            
            {/* Metadata */}
            <section>
              <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Quotation Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="flex flex-col mb-4">
                  <label className="mb-1.5 text-xs font-semibold text-corp-text-sec uppercase tracking-wider">
                    AI Template
                  </label>
                  <select 
                    onChange={e => handleSelectTemplate(e.target.value)}
                    defaultValue=""
                    className="border border-corp-border bg-white px-3 py-2.5 text-sm text-corp-text focus:outline-none focus:border-corp-accent focus:ring-1 focus:ring-corp-accent transition-colors cursor-pointer h-[46px]"
                  >
                    <option value="" disabled>-- Select Template --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <CorpInput label="Quotation Number" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} />
                <CorpInput label="Issue Date" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                <CorpInput label="Expiry Date" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              </div>
            </section>

            {/* Client Info */}
            <section>
              <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Client Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CorpInput label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                <CorpInput label="Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                <CorpInput label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <CorpInput label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
                <div className="col-span-1 sm:col-span-2">
                  <CorpInput label="Address" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Line Items */}
            <section>
              <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Line Items</h3>
              
              <div className="hidden sm:grid grid-cols-12 gap-3 mb-2 px-1">
                <div className="col-span-6 text-xs font-semibold text-corp-text-sec uppercase tracking-wider">Description</div>
                <div className="col-span-2 text-xs font-semibold text-corp-text-sec uppercase tracking-wider">Qty</div>
                <div className="col-span-3 text-xs font-semibold text-corp-text-sec uppercase tracking-wider">Unit Price ($)</div>
                <div className="col-span-1"></div>
              </div>

              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4 sm:mb-2 items-end bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-none border-gray-200">
                  <div className="sm:col-span-6">
                    <CorpInput 
                      label={""} 
                      placeholder="Item description"
                      value={item.description} 
                      onChange={e => handleItemChange(item.id, 'description', e.target.value)} 
                    />
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-2 sm:block gap-2">
                    <div className="sm:hidden text-xs font-medium text-gray-500 mb-1">Qty</div>
                    <CorpInput 
                      label={""} 
                      type="number" 
                      min="1"
                      value={item.quantity} 
                      onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} 
                    />
                  </div>
                  <div className="sm:col-span-3 grid grid-cols-2 sm:block gap-2">
                    <div className="sm:hidden text-xs font-medium text-gray-500 mb-1">Price</div>
                    <CorpInput 
                      label={""} 
                      type="number" 
                      min="0"
                      value={item.unitPrice} 
                      onChange={e => handleItemChange(item.id, 'unitPrice', Number(e.target.value))} 
                    />
                    {priceRecs[item.description.trim().toLowerCase()] && (
                      <div 
                        onClick={() => {
                          const avg = priceRecs[item.description.trim().toLowerCase()].average;
                          handleItemChange(item.id, 'unitPrice', avg);
                        }}
                        className="text-[10px] text-corp-text-sec cursor-pointer hover:text-black hover:underline font-mono bg-gray-50 p-1 border border-corp-border block text-center rounded-sm -mt-2 mb-2"
                        title="Click to apply optimal average price"
                      >
                        💡 AI Avg: ${priceRecs[item.description.trim().toLowerCase()].average.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-1 flex justify-end sm:pb-2">
                    <button 
                      className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 sm:bg-transparent px-3 py-1 sm:px-0 sm:py-0 rounded"
                      onClick={() => setItems(items.filter(i => i.id !== item.id))}
                      disabled={items.length === 1}
                    >
                      {items.length > 1 ? 'Remove' : ''}
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddItem}
                className="mt-4 text-sm text-corp-accent font-medium hover:text-black transition-colors flex items-center"
              >
                + Add Another Item
              </button>

              {/* AI Suggestions Section */}
              {suggestions.length > 0 && (
                <div className="mt-6 pt-4 border-t border-corp-border border-dashed">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-corp-text-sec flex items-center gap-1">
                      ✨ AI Recommended Add-ons
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.map((sugg, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setItems([
                            ...items,
                            {
                              id: uuidv4(),
                              description: sugg.description,
                              quantity: 1,
                              unitPrice: sugg.suggestedPrice,
                              amount: sugg.suggestedPrice
                            }
                          ]);
                          addNotification({
                            title: 'Suggested Item Added',
                            message: `Added: "${sugg.description}"`,
                            type: 'success'
                          });
                        }}
                        className="text-left text-xs bg-gray-50/50 border border-corp-border p-2.5 hover:bg-gray-100/50 hover:border-corp-text transition-all rounded-sm flex flex-col justify-between"
                        title={sugg.reason}
                      >
                        <div>
                          <div className="font-bold text-corp-text line-clamp-1">{sugg.description}</div>
                          <div className="text-[10px] text-corp-text-muted mt-1 leading-normal italic">{sugg.reason}</div>
                        </div>
                        <div className="text-[10px] text-corp-text flex justify-between items-center mt-2 pt-1.5 border-t border-gray-100 w-full font-sans">
                          <span className="font-mono font-medium">${sugg.suggestedPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          <span className="text-corp-accent font-bold hover:text-black transition-colors text-[9px] uppercase tracking-wider">Add +</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Calculations Form */}
            <section>
              <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Totals & Taxes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <CorpInput label="Discount (%)" type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} />
                <CorpInput label="GST (%)" type="number" min="0" max="100" value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))} />
              </div>
            </section>

            {/* Manager Approval Actions */}
            {existingQuotation?.status === 'Pending Approval' && (currentUser?.role === 'Manager' || currentUser?.role === 'Admin') && (
              <section className="bg-yellow-50 p-4 border border-yellow-200">
                <h3 className="text-sm font-bold text-yellow-800 mb-2">Manager Review Required</h3>
                <p className="text-sm text-yellow-700 mb-4">This quotation requires your approval before it can be finalized.</p>
                <div className="flex gap-3">
                  <CorpButton onClick={() => handleManagerAction('Approved')} className="bg-green-600 hover:bg-green-700 text-white border-transparent">Approve Quotation</CorpButton>
                  <CorpButton onClick={() => handleManagerAction('Rejected')} className="bg-red-600 hover:bg-red-700 text-white border-transparent">Reject</CorpButton>
                </div>
              </section>
            )}

            {/* Approval Timeline (If existing) */}
            {existingQuotation && (
              <section>
                <ApprovalTimeline steps={mockSteps} currentStatus={existingQuotation.status} />
              </section>
            )}
            
            {/* Version History */}
            {existingQuotation && (
              <section>
                <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Version History</h3>
                <div className="space-y-2">
                  <button onClick={async () => {
                    const versions = await useStore.getState().getQuotationVersions(existingQuotation.id);
                    const msg = versions.map((v: any) => `v${v.version_number} - ${new Date(v.created_at).toLocaleDateString()}`).join('\n');
                    if (versions.length > 0) {
                      const rollbackVersion = prompt(`Available Versions:\n${msg}\n\nEnter version number to rollback:` );
                      if (rollbackVersion && !isNaN(Number(rollbackVersion))) {
                        await useStore.getState().rollbackQuotation(existingQuotation.id, Number(rollbackVersion));
                        window.location.reload();
                      }
                    } else {
                      alert('No versions found.');
                    }
                  }} className="text-sm text-corp-accent font-medium hover:text-black">
                    View & Rollback Versions
                  </button>
                </div>
              </section>
            )}

            {/* Client Comments & Revision Chat */}
            {existingQuotation && (
              <section className="border-t border-corp-border pt-6 mt-6">
                <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Client Portal Comments</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4 border border-corp-border p-3 bg-gray-50/50">
                  {comments.length === 0 ? (
                    <p className="text-xs text-corp-text-muted italic">No comments or revision requests posted yet.</p>
                  ) : (
                    comments.map((c: any) => (
                      <div key={c.id} className={`p-2 rounded-sm border text-xs ${c.is_revision_request ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-corp-text">
                            {c.user ? `${c.user.username} (Staff)` : (c.client_name || 'Client')}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-corp-text-sec leading-relaxed">{c.content}</p>
                        {c.is_revision_request && (
                          <span className="mt-1 inline-block text-[8px] font-bold text-red-600 bg-red-100/50 px-1 rounded-sm">
                            ⚠️ Revision Request
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 text-xs p-2 border border-corp-border focus:border-corp-text outline-none font-sans"
                    placeholder="Reply to client..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <CorpButton className="px-4 py-2 text-xs" type="submit">Reply</CorpButton>
                </form>
              </section>
            )}

            {/* Quotation View logs */}
            {existingQuotation && (
              <section className="border-t border-corp-border pt-6 mt-6">
                <h3 className="text-xs font-bold text-corp-text-sec uppercase tracking-wider mb-4 border-b border-corp-border pb-2">Client View Logs</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-corp-border p-3 bg-gray-50/50 text-xs">
                  {viewLogs.length === 0 ? (
                    <p className="text-corp-text-muted italic">No view history recorded yet.</p>
                  ) : (
                    viewLogs.map((log: any) => (
                      <div key={log.id} className="flex justify-between text-corp-text-sec py-1 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="font-medium">IP: {log.ip_address}</p>
                          <p className="text-[9px] text-gray-400 truncate max-w-xs">{log.user_agent}</p>
                        </div>
                        <span className="text-[9px] text-gray-400 self-center">
                          {new Date(log.viewed_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

          </div>
        </div>

        {/* RIGHT PANEL: Live Preview */}
        <div className="flex flex-col h-full lg:sticky lg:top-[88px] max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between mb-6 shrink-0 gap-2">
            <h2 className="text-2xl font-serif text-corp-text font-semibold">Print Preview</h2>
            <div className="flex items-center gap-2">
              {existingQuotation && (
                <>
                  <CorpButton 
                    className="px-4 py-1.5 text-xs bg-white text-black border-gray-300 hover:bg-gray-50"
                    onClick={() => useStore.getState().uploadToDrive(existingQuotation.id)}
                  >
                    Save to Drive
                  </CorpButton>
                  <CorpButton 
                    className="px-4 py-1.5 text-xs bg-corp-text text-white border-transparent hover:bg-black"
                    onClick={() => useStore.getState().downloadPdf(existingQuotation.id)}
                  >
                    Download PDF
                  </CorpButton>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 bg-gray-100 border border-corp-border p-4 sm:p-8 overflow-y-auto shadow-inner rounded-sm relative">
            {/* The Document - A4 Aspect Ratio Approx */}
            <div className="bg-white mx-auto shadow-sm border border-gray-200 w-full max-w-[800px] min-h-[1056px] p-8 sm:p-12 flex flex-col font-sans text-sm relative">
              
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-corp-text pb-6 sm:pb-8 mb-8 gap-4 sm:gap-0">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold text-corp-text tracking-tight">QuoteFlow Pro</h1>
                  <p className="text-corp-text-sec mt-2 text-xs sm:text-sm">123 Corporate Blvd, Suite 400<br/>New York, NY 10001<br/>contact@quoteflow.pro</p>
                </div>
                <div className="sm:text-right">
                  <h2 className="text-2xl sm:text-3xl font-light text-corp-text-muted mb-3 tracking-widest uppercase">Quotation</h2>
                  <p className="text-corp-text text-xs sm:text-sm mb-1"><strong className="text-gray-500 font-medium">Quote Number:</strong> <span className="font-medium">{quotationNumber || '-'}</span></p>
                  <p className="text-corp-text text-xs sm:text-sm mb-1"><strong className="text-gray-500 font-medium">Issue Date:</strong> {new Date(issueDate).toLocaleDateString()}</p>
                  <p className="text-corp-text text-xs sm:text-sm"><strong className="text-gray-500 font-medium">Valid Until:</strong> {new Date(expiryDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Client Info */}
              <div className="mb-10">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-corp-text-sec mb-3">Prepared For</h3>
                <p className="text-xl text-corp-text font-serif font-medium mb-1">{companyName || 'Client Name'}</p>
                {contactPerson && <p className="text-sm text-corp-text mb-1">Attn: {contactPerson}</p>}
                {address && <p className="text-sm text-corp-text-sec mb-1 whitespace-pre-wrap">{address}</p>}
                {(email || phone) && <p className="text-sm text-corp-text-sec">{[email, phone].filter(Boolean).join(' | ')}</p>}
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
                    {items.map((item, index) => (
                      <tr key={item.id || index} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-4 px-2 text-corp-text text-sm">{item.description || '-'}</td>
                        <td className="py-4 px-2 text-center text-corp-text text-sm">{item.quantity}</td>
                        <td className="py-4 px-2 text-right text-corp-text text-sm">${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="py-4 px-2 text-right text-corp-text text-sm font-medium">${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="mt-auto flex justify-end mb-12">
                <div className="w-64 bg-gray-50/50 p-4 border border-gray-100">
                  <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                      <span>Discount ({discountPercent}%)</span>
                      <span className="text-red-600">-${discountAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  )}
                  {gstPercent > 0 && (
                    <div className="flex justify-between py-2 text-corp-text-sec text-sm">
                      <span>Tax ({gstPercent}%)</span>
                      <span>${gstAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 text-lg font-bold text-corp-text border-t-2 border-corp-text mt-2">
                    <span>Total</span>
                    <span>${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
        </div>

      </main>
    </div>
  );
};
