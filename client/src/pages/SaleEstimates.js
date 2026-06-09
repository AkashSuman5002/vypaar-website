import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { saleAPI, customerAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import Badge from '../components/UI/Badge';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion } from 'framer-motion';
import {
  Plus, Eye, Trash2, Printer, Download, Search, Filter, X, RefreshCw, MoreHorizontal,
  FileText, FileSpreadsheet, RotateCcw, ShoppingCart, Copy,
} from 'lucide-react';

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 }, { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 }, { label: 'Last Month', days: 60 }, { label: 'Custom', days: -1 },
];

const ESTIMATE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'estimate', label: 'Estimates' },
  { value: 'quotation', label: 'Quotations' },
  { value: 'proforma', label: 'Proforma' },
];

const SaleEstimates = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isProforma = location.pathname.includes('/proforma');
  const basePath = isProforma ? '/sales/proforma' : '/sales/estimates';
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: isProforma ? 'proforma' : '', customer: '', datePreset: '',
    dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'desc',
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actionMenu, setActionMenu] = useState(null);

  useEffect(() => {
    customerAPI.getAll().then(({ data }) => setCustomers(data)).catch(() => {});
  }, []);

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      let dateFrom = filters.dateFrom;
      let dateTo = filters.dateTo;
      if (filters.datePreset && filters.datePreset !== 'Custom') {
        dateTo = new Date().toISOString().split('T')[0];
        const d = new Date();
        d.setDate(d.getDate() - parseInt(filters.datePreset));
        dateFrom = d.toISOString().split('T')[0];
      }
      const eType = filters.type || ['estimate', 'quotation', 'proforma'].join(',');
      const { data } = await saleAPI.getAll({
        page, limit: 50, search, type: eType, ...filters,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      setEstimates(data.sales);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load estimates'); }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const handleConvertToInvoice = async (id) => {
    if (!window.confirm('Create an invoice from this document?')) return;
    try { await saleAPI.convertToInvoice(id); toast.success('Invoice created'); loadEstimates(); }
    catch { toast.error('Conversion failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this estimate?')) return;
    try { await saleAPI.delete(id); toast.success('Estimate deleted'); loadEstimates(); }
    catch { toast.error('Delete failed'); }
  };

  const handleDownloadPDF = async (sale) => {
    try {
      const res = await saleAPI.getPDF(sale._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${sale.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  const setDatePreset = (days) => {
    if (days === -1) { setShowFilters(true); return; }
    setFilters(f => ({ ...f, datePreset: String(days), dateFrom: '', dateTo: '' }));
  };

  const resetFilters = () => {
    setFilters({ type: '', customer: '', datePreset: '', dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'desc' });
    setSearch(''); setPage(1);
  };

  const activeFilterCount = [filters.type, filters.customer, filters.datePreset].filter(Boolean).length;

  const typeIcon = (type) => {
    if (type === 'quotation') return <FileSpreadsheet className="w-3.5 h-3.5" />;
    if (type === 'proforma') return <FileText className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{isProforma ? 'Proforma Invoices' : 'Estimates / Quotations'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} document{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={isProforma ? "Search proforma..." : "Search estimates..."} className="w-48 lg:w-64 pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-800 dark:text-blue-400' : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" /> Filters {activeFilterCount > 0 && <Badge variant="paid">{activeFilterCount}</Badge>}
          </button>
          <Link to="/sales/new" state={{ documentType: isProforma ? 'proforma' : 'estimate' }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> {isProforma ? 'New Proforma' : 'New Estimate'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Documents</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{total}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl"><FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estimates</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{estimates.filter(e => e.type === 'estimate').length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-500/10 rounded-xl"><FileSpreadsheet className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quotations</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{estimates.filter(e => e.type === 'quotation').length}</p></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map(p => (
          <button key={p.label} onClick={() => setDatePreset(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filters.datePreset === String(p.days) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-600'}`}
          >{p.label}</button>
        ))}
      </div>

      {showFilters && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Filter className="w-4 h-4" /> Filters</h3>
            <button onClick={resetFilters} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reset</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Type</label>
              <select value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                {ESTIMATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Customer</label>
              <select value={filters.customer} onChange={(e) => setFilters(f => ({ ...f, customer: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">All Customers</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Custom Range</label>
              <div className="flex gap-2">
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value, datePreset: '' }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value, datePreset: '' }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? <LoadingSpinner /> : estimates.length === 0 ? (
        <EmptyState icon={FileText} title={isProforma ? 'No Proforma Invoices' : 'No Estimates Yet'} description={isProforma ? 'Proforma invoices will appear here.' : 'Estimates, quotations, and proforma invoices will appear here.'} actionLabel={isProforma ? 'New Proforma' : 'New Estimate'} onAction={() => navigate('/sales/new', { state: { documentType: isProforma ? 'proforma' : 'estimate' } })} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Document</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden md:table-cell">Type</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {estimates.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <Link to={`${basePath}/${e._id}`} className="font-medium text-purple-600 dark:text-purple-400 hover:underline">{e.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{e.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 capitalize">
                        {typeIcon(e.type)} {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <Badge variant={e.status === 'confirmed' ? 'paid' : e.status === 'cancelled' ? 'cancelled' : 'default'}>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(e.totalAmount)}</td>
                    <td className="px-4 py-3 text-center relative">
                      <div className="flex items-center justify-center gap-0.5">
                        <Link to={`${basePath}/${e._id}`} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></Link>
                        <button onClick={() => handleConvertToInvoice(e._id)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors" title="Convert to Invoice"><ShoppingCart className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDownloadPDF(e)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
                        <div className="relative">
                          <button onClick={() => setActionMenu(actionMenu === e._id ? null : e._id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="More"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                          {actionMenu === e._id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg py-1 min-w-[180px]" onClick={() => setActionMenu(null)}>
                              <button onClick={() => navigate(`${basePath}/${e._id}/edit`)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><FileText className="w-3.5 h-3.5" /> Edit</button>
                              <button onClick={() => handleDelete(e._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {page} of {pages} ({total} total)</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">Prev</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default SaleEstimates;
