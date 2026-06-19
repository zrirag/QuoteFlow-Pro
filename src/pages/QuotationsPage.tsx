import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { CorpTable } from '../components/ui/CorpTable';
import { CorpInput } from '../components/ui/CorpInput';
import { CorpButton } from '../components/ui/CorpButton';
import { Badge } from '../components/ui/Badge';
import type { QuotationStatus } from '../types';
import { format } from 'date-fns';
import { Search, Plus, Filter, Download } from 'lucide-react';

export function QuotationsPage() {
  const navigate = useNavigate();
  const { quotations, fetchQuotations, deleteQuotation } = useStore();

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredQuotations = useMemo(() => {
    return quotations
      .filter(q => statusFilter === 'All' || q.status === statusFilter)
      .filter(q => 
        q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.clientInfo.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quotations, searchTerm, statusFilter]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredQuotations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredQuotations, currentPage]);

  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);

  const getStatusBadge = (status: QuotationStatus) => {
    switch(status) {
      case 'Draft': return <Badge variant="neutral">Draft</Badge>;
      case 'Pending Approval': return <Badge variant="warning">Pending</Badge>;
      case 'Approved': return <Badge variant="success">Approved</Badge>;
      case 'Rejected': return <Badge variant="error">Rejected</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const tableData = paginatedData.map(q => ({
    ...q,
    client: q.clientInfo.companyName,
    date: format(new Date(q.createdAt), 'MMM dd, yyyy'),
    amount: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(q.grandTotal),
    statusBadge: getStatusBadge(q.status),
    actions: (
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => navigate(`/builder?id=${q.id}`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
        <button onClick={() => deleteQuotation(q.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
      </div>
    )
  }));

  const columns = [
    { key: 'quotationNumber', header: 'Quote #' },
    { key: 'client', header: 'Client' },
    { key: 'date', header: 'Date Created' },
    { key: 'amount', header: 'Amount', align: 'right' as const },
    { key: 'statusBadge', header: 'Status' },
    { key: 'actions', header: '', align: 'right' as const },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-corp-text">Quotations</h1>
          <p className="text-corp-text-sec mt-1">Manage and track all corporate quotations.</p>
        </div>
        <CorpButton onClick={() => navigate('/builder')}>
          <Plus className="w-4 h-4 mr-2 inline" />
          New Quotation
        </CorpButton>
      </div>

      <div className="bg-white border border-corp-border p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by quote # or client..." 
            className="w-full pl-10 pr-4 py-2 border border-corp-border focus:outline-none focus:border-corp-text transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => useStore.getState().exportExcel()}
            className="px-4 py-2 bg-white border border-corp-border text-corp-text hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel Export
          </button>
          <button 
            onClick={() => useStore.getState().exportCsv()}
            className="px-4 py-2 bg-white border border-corp-border text-corp-text hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV Export
          </button>
          <div className="flex items-center text-sm text-gray-600">
            <Filter className="w-4 h-4 mr-2" />
            <select 
              className="border-none focus:outline-none bg-transparent font-medium cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <CorpTable 
        columns={columns} 
        data={tableData} 
        onRowClick={(row) => navigate(`/builder?id=${row.id}`)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <p className="text-sm text-gray-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredQuotations.length)} of {filteredQuotations.length} entries
          </p>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 border border-corp-border bg-white text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 border border-corp-border bg-white text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
