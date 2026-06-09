import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { receiptAPI, saleAPI, customerAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import useSettings from '../hooks/useSettings';
import { motion } from 'framer-motion';
import {
  Search, Filter, RefreshCw, Download, Eye, DollarSign, Banknote,
  Wallet, Zap, Landmark, CreditCard, HelpCircle, FileDigit, Plus,
} from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'upi', label: 'UPI', icon: Zap },
  { value: 'bank', label: 'Bank Transfer', icon: Landmark },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', icon: FileDigit },
  { value: 'credit', label: 'Credit', icon: HelpCircle },
];

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 }, { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 }, { label: 'Last Month', days: 60 }, { label: 'Custom', days: -1 },
];

const SalePayments = () => {
  const { getPref } = useSettings();
  const discountDuringPaymentsEnabled = getPref('transaction', 'discountDuringPayments');
  const linkPaymentsToInvoiceEnabled = getPref('transaction', 'linkPaymentsToInvoice');
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    mode: '', customer: '', datePreset: '', dateFrom: '', dateTo: '',
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [payment, setPayment] = useState({
    invoiceId: '', amount: 0, mode: 'cash', date: new Date().toISOString().split('T')[0],
    transactionNo: '', bankName: '', chequeNo: '', referenceNo: '', notes: '',
  });

  useEffect(() => {
    customerAPI.getAll().then(({ data }) => setCustomers(data)).catch(() => {});
    saleAPI.getAll({ limit: 200, paymentStatus: 'unpaid,partial' }).then(({ data }) => setInvoices(data.sales || [])).catch(() => {});
  }, []);

  const loadReceipts = useCallback(async () => {
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
      const { data } = await receiptAPI.getAll({
        page, limit: 50, search, ...filters,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      setReceipts(data.receipts);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load receipts'); }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!payment.invoiceId) return toast.error('Select an invoice');
    const effectiveAmount = (payment.amount || 0) - (payment.discount || 0);
    if (effectiveAmount <= 0) return toast.error('Enter a valid amount');
    setSubmitting(true);
    try {
      const payload = { ...payment, amount: effectiveAmount };
      const { data } = await saleAPI.receivePayment(payment.invoiceId, payload);
      toast.success(`Payment received - ${data.receipt.receiptNumber}`);
      setShowReceive(false);
      setPayment({ invoiceId: '', amount: 0, discount: 0, mode: 'cash', date: new Date().toISOString().split('T')[0], transactionNo: '', bankName: '', chequeNo: '', referenceNo: '', notes: '' });
      loadReceipts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDownloadPDF = async (r) => {
    try {
      const res = await receiptAPI.getPDF(r._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${r.receiptNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed'); }
  };

  const setDatePreset = (days) => {
    if (days === -1) { setShowFilters(true); return; }
    setFilters(f => ({ ...f, datePreset: String(days), dateFrom: '', dateTo: '' }));
  };

  const resetFilters = () => {
    setFilters({ mode: '', customer: '', datePreset: '', dateFrom: '', dateTo: '' });
    setSearch(''); setPage(1);
  };

  const activeFilterCount = [filters.mode, filters.customer, filters.datePreset].filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Payment-In</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} receipt{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search receipts..." className="w-48 lg:w-64 pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-800 dark:text-blue-400' : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" /> Filters {activeFilterCount > 0 && <Badge variant="paid">{activeFilterCount}</Badge>}
          </button>
          <button onClick={() => setShowReceive(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
            <Banknote className="w-4 h-4" /> Receive Payment
          </button>
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Mode</label>
              <select value={filters.mode} onChange={(e) => setFilters(f => ({ ...f, mode: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">All Modes</option>
                {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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

      {loading ? <LoadingSpinner /> : receipts.length === 0 ? (
        <EmptyState icon={Banknote} title="No Payments Yet" description="Received payments will appear here." actionLabel="Receive Payment" onAction={() => setShowReceive(true)} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Receipt No</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden md:table-cell">Invoice</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Mode</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {receipts.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3"><span className="font-medium text-emerald-600 dark:text-emerald-400">{r.receiptNumber}</span></td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{r.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      {r.invoiceNumber || '-'}
                      {linkPaymentsToInvoiceEnabled && r.invoiceNumber && (
                        <span className="block text-xs text-blue-600 dark:text-blue-400">Linked to: {r.invoiceNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs capitalize text-slate-600 dark:text-slate-400">
                        {React.createElement(PAYMENT_MODES.find(m => m.value === r.mode)?.icon || DollarSign, { className: 'w-3 h-3' })}
                        {r.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => handleDownloadPDF(r)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
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

      <Modal open={showReceive} onClose={() => setShowReceive(false)} title="Receive Payment">
        <form onSubmit={handleReceivePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Select Invoice</label>
            <select value={payment.invoiceId} onChange={(e) => {
              const inv = invoices.find(i => i._id === e.target.value);
              setPayment(p => ({ ...p, invoiceId: e.target.value, amount: inv?.remainingBalance || 0 }));
            }} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required>
              <option value="">Select Invoice</option>
              {invoices.map(inv => (
                <option key={inv._id} value={inv._id}>{inv.invoiceNumber} - {inv.customerName} (Due: {formatCurrency(inv.remainingBalance)})</option>
              ))}
            </select>
            {linkPaymentsToInvoiceEnabled && !payment.invoiceId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Please select an invoice to link this payment</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
              <input type="date" value={payment.date} onChange={(e) => setPayment(p => ({ ...p, date: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Amount</label>
              <input type="number" min="0" step="0.01" value={payment.amount} onChange={(e) => setPayment(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required />
            </div>
          </div>
          {discountDuringPaymentsEnabled && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Discount</label>
              <input type="number" min="0" step="0.01" value={payment.discount || ''} onChange={(e) => setPayment(p => ({ ...p, discount: Number(e.target.value) }))} placeholder="0" className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Mode</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_MODES.map(pm => (
                <button key={pm.value} type="button" onClick={() => setPayment(p => ({ ...p, mode: pm.value }))}
                  className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all border ${payment.mode === pm.value ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-blue-200'}`}>
                  <pm.icon className="w-3 h-3" />{pm.label}
                </button>
              ))}
            </div>
          </div>
          {(payment.mode === 'bank' || payment.mode === 'card') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Transaction No</label>
                <input value={payment.transactionNo} onChange={(e) => setPayment(p => ({ ...p, transactionNo: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Bank Name</label>
                <input value={payment.bankName} onChange={(e) => setPayment(p => ({ ...p, bankName: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            </div>
          )}
          {payment.mode === 'cheque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Cheque No</label>
                <input value={payment.chequeNo} onChange={(e) => setPayment(p => ({ ...p, chequeNo: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Bank Name</label>
                <input value={payment.bankName} onChange={(e) => setPayment(p => ({ ...p, bankName: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
            <textarea value={payment.notes} onChange={(e) => setPayment(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowReceive(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};

export default SalePayments;
