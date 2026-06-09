import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saleAPI, customerAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import Badge from '../components/UI/Badge';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion } from 'framer-motion';
import {
  Plus, Eye, Trash2, Search, Filter, RefreshCw, Download,
  ShoppingCart, ClipboardList,
} from 'lucide-react';

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 }, { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 }, { label: 'Last Month', days: 60 }, { label: 'Custom', days: -1 },
];

const SaleOrders2 = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    customer: '', datePreset: '', dateFrom: '', dateTo: '',
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    customerAPI.getAll().then(({ data }) => setCustomers(data)).catch(() => {});
  }, []);

  const loadOrders = useCallback(async () => {
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
      const { data } = await saleAPI.getAll({
        page, limit: 50, search, type: 'order', ...filters,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      setOrders(data.sales);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleConvertToInvoice = async (id) => {
    if (!window.confirm('Create an invoice from this order?')) return;
    try { await saleAPI.convertToInvoice(id); toast.success('Invoice created'); loadOrders(); }
    catch { toast.error('Conversion failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try { await saleAPI.delete(id); toast.success('Order deleted'); loadOrders(); }
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
    setFilters({ customer: '', datePreset: '', dateFrom: '', dateTo: '' });
    setSearch(''); setPage(1);
  };

  const activeFilterCount = [filters.customer, filters.datePreset].filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sale Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} order{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search orders..." className="w-48 lg:w-64 pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-800 dark:text-blue-400' : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" /> Filters {activeFilterCount > 0 && <Badge variant="paid">{activeFilterCount}</Badge>}
          </button>
          <Link to="/sales/new" state={{ documentType: 'order' }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Order
          </Link>
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

      {loading ? <LoadingSpinner /> : orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No Sale Orders" description="Sale orders will appear here." actionLabel="New Order" onAction={() => navigate('/sales/new', { state: { documentType: 'order' } })} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Order No</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(o.date)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/sales/orders/${o._id}`} className="font-medium text-purple-600 dark:text-purple-400 hover:underline">{o.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{o.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <Badge variant={o.status === 'confirmed' ? 'paid' : o.status === 'cancelled' ? 'cancelled' : 'default'}>{o.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Link to={`/sales/orders/${o._id}`} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></Link>
                        <button onClick={() => handleConvertToInvoice(o._id)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors" title="Convert to Invoice"><ShoppingCart className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDownloadPDF(o)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(o._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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

export default SaleOrders2;
