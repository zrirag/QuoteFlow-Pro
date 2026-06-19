import React from 'react';
import { TopNavigation } from '../components/layout/TopNavigation';
import { CorpCard } from '../components/ui/CorpCard';
import { CorpTable } from '../components/ui/CorpTable';
import { CorpButton } from '../components/ui/CorpButton';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    quotations, 
    fetchQuotations, 
    fetchManagerInsights 
  } = useStore();

  const [insights, setInsights] = React.useState<any | null>(null);

  React.useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  React.useEffect(() => {
    if (currentUser?.role === 'Manager' || currentUser?.role === 'Admin') {
      fetchManagerInsights().then(data => {
        setInsights(data);
      });
    }
  }, [currentUser, fetchManagerInsights]);

  // Dynamic Metrics Calculation
  const metrics = React.useMemo(() => {
    const totalRevenue = quotations
      .filter(q => ['Approved', 'Client Signed', 'Paid'].includes(q.status))
      .reduce((sum, q) => sum + Number(q.grandTotal), 0);

    const pendingApprovals = quotations.filter(q => q.status === 'Pending Approval').length;

    const totalDeals = quotations.filter(q => q.status !== 'Draft').length;
    const wonDeals = quotations.filter(q => ['Client Signed', 'Paid'].includes(q.status)).length;
    const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

    return [
      { label: 'Total Value (Approved/Won)', value: `$${(totalRevenue / 1000).toFixed(0)}k`, trend: `Total ${quotations.filter(q => ['Approved', 'Client Signed', 'Paid'].includes(q.status)).length}` },
      { label: 'Quotations Created', value: String(quotations.length), trend: 'Active' },
      { label: 'Pending Approvals', value: String(pendingApprovals), trend: `${pendingApprovals} review(s) required` },
      { label: 'Estimated Win Rate', value: `${winRate}%`, trend: `${wonDeals} won of ${totalDeals} active` },
    ];
  }, [quotations]);

  // Dynamic Recent Quotes mapping
  const recentQuotes = React.useMemo(() => {
    return quotations.slice(0, 5).map(q => ({
      id: q.quotationNumber,
      client: q.clientInfo?.companyName || 'N/A',
      amount: `$${Number(q.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      status: (
        <span className={`font-medium ${
          q.status === 'Approved' ? 'text-green-700' :
          q.status === 'Pending Approval' ? 'text-amber-600' :
          q.status === 'Draft' ? 'text-gray-500' :
          q.status === 'Client Signed' ? 'text-blue-700' :
          q.status === 'Paid' ? 'text-emerald-700' : 'text-red-600'
        }`}>
          {q.status}
        </span>
      ),
      date: new Date(q.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rawId: q.id
    }));
  }, [quotations]);

  const columns = [
    { key: 'id', header: 'Quote ID' },
    { key: 'client', header: 'Client' },
    { key: 'amount', header: 'Amount', align: 'right' as const },
    { key: 'status', header: 'Status' },
    { key: 'date', header: 'Date', align: 'right' as const },
  ];

  const handleRowClick = (row: any) => {
    navigate(`/builder?id=${row.rawId}`);
  };

  return (
    <div className="min-h-screen bg-corp-bg flex flex-col">
      <TopNavigation />
      
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif text-corp-text font-semibold">Executive Dashboard</h1>
            <p className="text-corp-text-sec mt-1 font-sans">Overview of your quotation metrics and recent activity.</p>
          </div>
          <CorpButton onClick={() => navigate('/builder')}>Create New Quote</CorpButton>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {metrics.map((metric, idx) => (
            <CorpCard key={idx} className="flex flex-col">
              <span className="text-xs text-corp-text-sec font-bold tracking-wide uppercase">{metric.label}</span>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-4xl font-serif text-corp-text tracking-tight">{metric.value}</span>
                <span className="text-xs font-mono font-medium text-corp-text-sec">
                  {metric.trend}
                </span>
              </div>
            </CorpCard>
          ))}
        </div>

        {/* AI Deal Insights Section (Manager/Admin Only) */}
        {(currentUser?.role === 'Manager' || currentUser?.role === 'Admin') && (
          <div className="mb-10 bg-white border border-corp-border p-6 shadow-sm">
            <h2 className="text-xl font-serif text-corp-text font-semibold border-b border-corp-border pb-3 mb-6 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-black animate-pulse rounded-full"></span>
              AI Deal Intelligence Feed
            </h2>
            
            {insights ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Leakage Alert */}
                <div className="border border-corp-border p-4 space-y-4">
                  <span className="text-xs font-bold text-corp-text-sec uppercase tracking-wider block border-b border-corp-border pb-2">Revenue Leakage</span>
                  <div className="space-y-2">
                    <p className="text-xs text-corp-text-sec">
                      Total Revenue Leakage from discounts:
                    </p>
                    <div className="text-2xl font-serif text-red-700 font-bold">
                      ${insights.revenueLeakage.totalLeakage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-xs text-corp-text-muted">
                      Average discount rate across active deals: <span className="font-bold text-corp-text">{insights.revenueLeakage.averageDiscount.toFixed(1)}%</span>
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                      insights.revenueLeakage.trend === 'up' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      Trend MoM: {insights.revenueLeakage.trend.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Stale Deal Follow-ups */}
                <div className="border border-corp-border p-4 space-y-4 col-span-1 lg:col-span-1">
                  <span className="text-xs font-bold text-corp-text-sec uppercase tracking-wider block border-b border-corp-border pb-2">Stale Deals & Follow-ups</span>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {insights.followUps.length === 0 ? (
                      <p className="text-xs text-corp-text-muted italic">No pending follow-ups. All deals are moving on schedule.</p>
                    ) : (
                      insights.followUps.map((fu: any) => (
                        <div key={fu.id} className="border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <span 
                              onClick={() => navigate(`/builder?id=${fu.id}`)}
                              className="text-xs font-bold text-corp-text hover:underline cursor-pointer"
                            >
                              {fu.quotationNumber} - {fu.client}
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-sm">
                              {fu.daysStale}d Stale
                            </span>
                          </div>
                          <p className="text-[11px] text-corp-text-sec mt-1 leading-normal">{fu.recommendation}</p>
                          <div className="text-[10px] font-mono text-corp-text-sec mt-1.5">Value: ${fu.grandTotal.toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Deal Win Estimator */}
                <div className="border border-corp-border p-4 space-y-4">
                  <span className="text-xs font-bold text-corp-text-sec uppercase tracking-wider block border-b border-corp-border pb-2">AI Deal Win Probability</span>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {insights.dealProbabilities.length === 0 ? (
                      <p className="text-xs text-corp-text-muted italic">No active deals estimated yet.</p>
                    ) : (
                      insights.dealProbabilities.map((deal: any) => (
                        <div key={deal.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span 
                              onClick={() => navigate(`/builder?id=${deal.id}`)}
                              className="text-xs font-bold text-corp-text hover:underline cursor-pointer block"
                            >
                              {deal.quotationNumber} - {deal.client}
                            </span>
                            <span className="text-[10px] text-corp-text-muted uppercase font-semibold">{deal.status}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold font-mono px-2 py-1 ${
                              deal.winProbability >= 80 ? 'text-green-700 bg-green-50' :
                              deal.winProbability >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                            }`}>
                              {deal.winProbability}% Odds
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-xs text-corp-text-sec italic py-4">Generating Rule-Based AI intelligence feed...</div>
            )}
          </div>
        )}

        {/* Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-serif text-corp-text font-semibold border-b border-corp-border pb-2">Recent Quotations</h2>
            {recentQuotes.length > 0 ? (
              <CorpTable 
                columns={columns} 
                data={recentQuotes} 
                onRowClick={handleRowClick}
              />
            ) : (
              <p className="text-xs text-corp-text-muted italic py-4">No quotations created yet.</p>
            )}
          </div>
          
          <div className="space-y-6">
            <h2 className="text-xl font-serif text-corp-text font-semibold border-b border-corp-border pb-2">Quick Actions</h2>
            <CorpCard>
              <div className="space-y-4 flex flex-col font-sans">
                <button 
                  onClick={() => navigate('/quotations')}
                  className="text-left text-xs text-corp-text hover:text-corp-accent py-2 border-b border-corp-bg-sec transition-colors font-bold uppercase tracking-wider"
                >
                  Review All Quotations
                </button>
                <button 
                  onClick={() => navigate('/builder')}
                  className="text-left text-xs text-corp-text hover:text-corp-accent py-2 border-b border-corp-bg-sec transition-colors font-bold uppercase tracking-wider"
                >
                  Create Quotation Draft
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="text-left text-xs text-corp-text hover:text-corp-accent py-2 transition-colors font-bold uppercase tracking-wider"
                >
                  System Configuration
                </button>
              </div>
            </CorpCard>
          </div>
        </div>

      </main>
    </div>
  );
};
