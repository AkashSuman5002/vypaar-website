import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API, { saleAPI, settingAPI, customerAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion } from 'framer-motion';
import {
  Plus, Eye, Trash2, Printer, Share2, Download, Edit3, Copy, RotateCcw,
  Truck, FileText, Search, Filter, X, ChevronDown, Calendar, ShoppingCart,
  TrendingUp, Clock, AlertCircle, CheckCircle,   Wallet, ArrowUpDown,
  FileSpreadsheet, MessageSquare, MoreHorizontal, RefreshCw, Split, DollarSign,
} from 'lucide-react';

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 }, { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 }, { label: 'Last Month', days: 60 }, { label: 'Custom', days: -1 },
];

const PAYMENT_METHODS = [
  { value: '', label: 'All Methods' },
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' }, { value: 'card', label: 'Card' }, { value: 'cheque', label: 'Cheque' },
];

const Sales = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({ totalSales: 0, totalPaid: 0, totalOutstanding: 0, count: 0 });
  const [customers, setCustomers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    paymentStatus: '', customer: '', paymentMethod: '', datePreset: '',
    dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'desc',
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actionMenu, setActionMenu] = useState(null);
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, mode: 'cash', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    customerAPI.getAll().then(({ data }) => setCustomers(data)).catch(() => {});
  }, []);

  const loadSales = useCallback(async () => {
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
        page, limit: 50, search, ...filters,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      setSales(data.sales);
      setDashboard(data.dashboard);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try { await saleAPI.delete(id); toast.success('Invoice cancelled'); loadSales(); }
    catch { toast.error('Delete failed'); }
  };

  const handleDuplicate = async (id) => {
    try {
      const { data } = await saleAPI.duplicate(id);
      toast.success('Invoice duplicated');
      navigate(`/sales/${data._id}/edit`);
    } catch { toast.error('Duplicate failed'); }
  };

  const handleConvertToReturn = async (id) => {
    if (!window.confirm('Convert this invoice to a Sale Return (Credit Note)?')) return;
    try { await saleAPI.convertToReturn(id); toast.success('Converted to Credit Note'); loadSales(); }
    catch { toast.error('Conversion failed'); }
  };

  const handleConvertToChallan = async (id) => {
    try { await saleAPI.convertToChallan(id); toast.success('Delivery Challan created'); loadSales(); }
    catch { toast.error('Conversion failed'); }
  };

  const handlePrint = async (sale) => {
    let bizName = 'Your Business', bizAddr = '', bizPhone = '', bizEmail = '', bizGst = '', bizLogo = '';
    try {
      const { data } = await settingAPI.get();
      if (data) { bizName = data.businessName || bizName; bizAddr = data.address || ''; bizPhone = data.phone || ''; bizEmail = data.email || ''; bizGst = data.gstNumber || ''; bizLogo = data.logo ? `${API.defaults.baseURL.replace('/api', '')}/${data.logo}` : ''; }
    } catch {}
    const w = window.open('', '_blank');
    const statusColor = sale.paymentStatus === 'paid' ? '#059669' : sale.paymentStatus === 'partial' ? '#d97706' : '#dc2626';
    const statusBg = sale.paymentStatus === 'paid' ? '#d1fae5' : sale.paymentStatus === 'partial' ? '#fef3c7' : '#fee2e2';
    const statusLabel = sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid';
    w.document.write(`<html><head><title>Invoice ${sale.invoiceNumber}</title>
<style>@page{margin:10mm;size:A4}*{box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;margin:0;padding:0;background:#fff;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.invoice{max-width:190mm;margin:0 auto;padding:40px}
.header{display:flex;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #e2e8f0;margin-bottom:24px}
.header-left{display:flex;gap:16px;align-items:flex-start}.header-left img{width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0}
.biz-name{font-size:20px;font-weight:700;margin:0 0 4px;color:#0f172a}.biz-info{font-size:12px;color:#64748b;margin:0;line-height:1.5}
.header-right{text-align:right}.status-badge{display:inline-block;padding:4px 14px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.5px;border:1px solid ${statusColor};background:${statusBg};color:${statusColor}}
.invoice-title{font-size:26px;font-weight:800;color:#2563eb;margin:12px 0 0}
.meta-row{font-size:13px;margin:6px 0 0;color:#0f172a}.meta-row span{color:#64748b}.meta-row strong{font-weight:600}
.section-title{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px}
.bill-to{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;margin-bottom:24px}
.bill-to p{margin:0;font-size:13px}.bill-to .name{font-weight:700;color:#0f172a}.bill-to .detail{color:#64748b;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
th{padding:12px 10px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc}
th.right,td.right{text-align:right}th.center{text-align:center}
td{padding:10px;border-bottom:1px solid #f1f5f9;color:#334155}td.center{text-align:center;color:#64748b}td .prod-name{font-weight:500;color:#0f172a}td .gst-pct{color:#2563eb;font-weight:500}
tr:nth-child(even){background:#f8fafc80}.summary-wrap{display:flex;gap:24px;margin-bottom:24px}
.words-box{flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc}.words-box p{margin:0;font-size:13px;font-weight:500;color:#0f172a}
.summary-card{min-width:240px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.summary-card table{margin:0}
.summary-card td{padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}
.summary-card td:last-child{text-align:right;font-weight:500}.summary-card .grand td{font-weight:700;font-size:14px;background:#f8fafc;border-bottom:none}
.payment-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.paid-card{border:1px solid #a7f3d0;border-radius:12px;padding:12px;background:#ecfdf5}.paid-card .lbl{font-size:11px;font-weight:500;color:#059669}.paid-card .val{font-size:14px;font-weight:700;color:#047857;margin:2px 0 0}
.bal-card{border:1px solid #fcd34d;border-radius:12px;padding:12px;background:#fffbeb}.bal-card .lbl{font-size:11px;font-weight:500;color:#d97706}.bal-card .val{font-size:14px;font-weight:700;color:#b45309;margin:2px 0 0}
.footer{border-top:1px solid #e2e8f0;padding-top:24px;display:flex;justify-content:space-between}
.footer-left{font-size:14px;font-weight:500}.footer-left .sign-line{margin-top:16px;width:140px;border-top:1px solid #d1d5db;padding-top:8px;font-size:11px;color:#94a3b8}
.footer-right{text-align:right;font-size:11px}.footer-right .terms-lbl{font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.footer-right .terms{color:#94a3b8;margin-top:4px;max-width:240px;line-height:1.5}
</style></head><body><div class="invoice">
<div class="header"><div class="header-left">${bizLogo ? `<img src="${bizLogo}" alt="Logo"/>` : ''}<div><p class="biz-name">${bizName}</p>${bizAddr ? `<p class="biz-info">${bizAddr}</p>` : ''}<p class="biz-info">${bizPhone || ''}${bizPhone && bizEmail ? ' | ' : ''}${bizEmail || ''}</p>${bizGst ? `<p class="biz-info" style="margin-top:4px">GST: ${bizGst}</p>` : ''}</div></div>
<div class="header-right"><span class="status-badge">${statusLabel}</span><p class="invoice-title">TAX INVOICE</p><p class="meta-row"><span>Invoice: </span><strong>${sale.invoiceNumber}</strong></p><p class="meta-row"><span>Date: </span><strong>${formatDate(sale.date)}</strong></p></div></div>
${sale.customer ? `<div class="bill-to"><p class="section-title">Bill To</p><p class="name">${sale.customerName || 'Walk-in'}</p>${sale.billingAddress ? `<p class="detail">${sale.billingAddress}</p>` : ''}${sale.customerPhone ? `<p class="detail">${sale.customerPhone}</p>` : ''}</div>` : ''}
<table><thead><tr><th class="center">#</th><th>Product</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Taxable</th><th class="right">CGST</th><th class="right">SGST</th><th class="right">Total</th></tr></thead><tbody>${sale.items.map((item, idx) => `<tr><td class="center">${idx + 1}</td><td><span class="prod-name">${item.productName}</span></td><td class="right">${item.quantity}</td><td class="right">${formatCurrency(item.rate)}</td><td class="right">${formatCurrency(item.taxableAmount || item.amount)}</td><td class="right" style="color:#2563eb">${item.cgst ? formatCurrency(item.cgst) : '-'}</td><td class="right" style="color:#2563eb">${item.sgst ? formatCurrency(item.sgst) : '-'}</td><td class="right" style="font-weight:600">${formatCurrency(item.amount)}</td></tr>`).join('')}</tbody></table>
<div class="summary-wrap"><div class="words-box"><p style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Amount In Words</p><p>${(() => { const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']; const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']; const w=(n)=>{if(n<20)return a[n];if(n<100)return b[Math.floor(n/10)]+(n%10?' '+a[n%10]:'');if(n<1000)return a[Math.floor(n/100)]+' Hundred'+(n%100?' '+w(n%100):'');if(n<100000)return w(Math.floor(n/1000))+' Thousand'+(n%1000?' '+w(n%1000):'');if(n<10000000)return w(Math.floor(n/100000))+' Lakh'+(n%100000?' '+w(n%100000):'');return w(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+w(n%10000000):'')}; return w(Math.floor(sale.totalAmount))+' Rupees Only'; })()}</p></div>
<div class="summary-card"><table><tbody><tr><td>Subtotal</td><td>${formatCurrency(sale.taxableAmount || sale.totalAmount)}</td></tr><tr><td>CGST</td><td style="color:#2563eb">${formatCurrency(sale.cgstTotal || 0)}</td></tr><tr><td>SGST</td><td style="color:#2563eb">${formatCurrency(sale.sgstTotal || 0)}</td></tr><tr class="grand"><td>Grand Total</td><td>${formatCurrency(sale.totalAmount)}</td></tr></tbody></table><div style="padding:10px 16px"><div class="payment-grid"><div class="paid-card"><p class="lbl">Paid</p><p class="val">${formatCurrency(sale.paidAmount)}</p></div><div class="bal-card"><p class="lbl">Balance</p><p class="val">${formatCurrency(sale.remainingBalance)}</p></div></div></div></div></div>
<div class="footer"><div class="footer-left">Thank you!<div class="sign-line">Authorized Signature</div></div><div class="footer-right"><div class="terms-lbl">Terms & Conditions</div><div class="terms">Goods once sold will not be taken back.</div></div></div></div></body></html>`);
    w.document.close(); w.print();
  };

  const handleDownloadPDF = async (sale) => {
    try {
      const res = await saleAPI.getPDF(sale._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${sale.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  const handleShareWhatsApp = (sale) => {
    const msg = `*Invoice ${sale.invoiceNumber}*\nAmount: ${formatCurrency(sale.totalAmount)}\nStatus: ${sale.paymentStatus}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleReceivePayment = async () => {
    if (!paymentSale || paymentForm.amount <= 0) return toast.error('Enter a valid amount');
    try {
      await saleAPI.receivePayment(paymentSale._id, paymentForm);
      toast.success('Payment received');
      setPaymentSale(null);
      setPaymentForm({ amount: 0, mode: 'cash', date: new Date().toISOString().split('T')[0] });
      loadSales();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const setDatePreset = (days) => {
    if (days === -1) { setShowFilters(true); return; }
    setFilters(f => ({ ...f, datePreset: String(days), dateFrom: '', dateTo: '' }));
  };

  const resetFilters = () => {
    setFilters({ paymentStatus: '', customer: '', paymentMethod: '', datePreset: '', dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'desc' });
    setSearch(''); setPage(1);
  };

  const activeFilterCount = [filters.paymentStatus, filters.customer, filters.paymentMethod, filters.datePreset].filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sales</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} invoice{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search invoices..." className="w-48 lg:w-64 pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-800 dark:text-blue-400' : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" /> Filters {activeFilterCount > 0 && <Badge variant="paid">{activeFilterCount}</Badge>}
          </button>
          <Link to="/sales/quick" className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Quick
          </Link>
          <Link to="/sales/new" state={{ documentType: 'invoice' }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Sale
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sales</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(dashboard.totalSales)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Received</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(dashboard.totalPaid)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl"><Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outstanding</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(dashboard.totalOutstanding)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl"><FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoices</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{dashboard.count}</p></div>
          </div>
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map(p => (
          <button key={p.label} onClick={() => setDatePreset(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filters.datePreset === String(p.days) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-600'}`}
          >{p.label}</button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Filter className="w-4 h-4" /> Filters</h3>
            <button onClick={resetFilters} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reset</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
              <select value={filters.paymentStatus} onChange={(e) => setFilters(f => ({ ...f, paymentStatus: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partially Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Method</label>
              <select value={filters.paymentMethod} onChange={(e) => setFilters(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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

      {/* Table */}
      {loading ? <LoadingSpinner /> : sales.length === 0 ? (
        <EmptyState type="sales" actionLabel="New Invoice" onAction={() => navigate('/sales/new', { state: { documentType: 'invoice' } })} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Invoice</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden md:table-cell">Mobile</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Type</th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Payment</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:table-cell">Received</th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:table-cell">Balance</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {sales.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(s.date)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/sales/${s._id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{s.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{s.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{s.customerPhone || '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Badge variant={s.type === 'invoice' ? 'paid' : 'default'}>{s.type}</Badge>{s.isRecurringTemplate && <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-800">Recurring</span>}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-slate-400 capitalize">{s.payments?.[0]?.mode || s.paymentMethod || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(s.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 hidden sm:table-cell">{formatCurrency(s.paidAmount)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={`font-medium ${s.remainingBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(s.remainingBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.paymentStatus !== 'paid' ? (
                        <button onClick={() => { setPaymentSale(s); setPaymentForm(f => ({ ...f, amount: s.remainingBalance })); }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${s.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-800'}`}
                        >
                          {s.paymentStatus === 'partial' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {s.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                        </button>
                      ) : (
                        <Badge variant="paid">Paid</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <div className="flex items-center justify-center gap-0.5">
                        <Link to={`/sales/${s._id}`} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></Link>
                        <Link to={`/sales/${s._id}/edit`} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-500 dark:text-blue-400 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></Link>
                        <button onClick={() => handlePrint(s)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Print"><Printer className="w-3.5 h-3.5" /></button>
                        <div className="relative">
                          <button onClick={() => setActionMenu(actionMenu === s._id ? null : s._id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="More"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                          {actionMenu === s._id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg py-1 min-w-[200px]" onClick={() => setActionMenu(null)}>
                              <button onClick={() => handleDuplicate(s._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><Copy className="w-3.5 h-3.5" /> Duplicate</button>
                              <button onClick={() => handleDownloadPDF(s)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><Download className="w-3.5 h-3.5" /> Download PDF</button>
                              <button onClick={() => handleShareWhatsApp(s)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><MessageSquare className="w-3.5 h-3.5" /> Share WhatsApp</button>
                              <div className="h-px bg-slate-100 dark:bg-gray-700 my-1" />
                              <button onClick={() => handleConvertToChallan(s._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><Truck className="w-3.5 h-3.5" /> Convert to Challan</button>
                              <button onClick={() => handleConvertToReturn(s._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><RotateCcw className="w-3.5 h-3.5" /> Convert to Return</button>
                              <div className="h-px bg-slate-100 dark:bg-gray-700 my-1" />
                              <button onClick={() => handleDelete(s._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Cancel Invoice</button>
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
      <Modal open={!!paymentSale} onClose={() => setPaymentSale(null)} title={`Receive Payment - ${paymentSale?.invoiceNumber || ''}`}>
        <div className="space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Customer: <strong>{paymentSale?.customerName || 'Walk-in'}</strong>
            <br />
            Total: <strong>{formatCurrency(paymentSale?.totalAmount || 0)}</strong>
            <span className="ml-4">Due: <strong className="text-red-600">{formatCurrency(paymentSale?.remainingBalance || 0)}</strong></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
              <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Amount</label>
              <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Mode</label>
            <select value={paymentForm.mode} onChange={(e) => setPaymentForm(f => ({ ...f, mode: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setPaymentSale(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700">Cancel</button>
            <button onClick={handleReceivePayment} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Receive Payment</button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default Sales;
