import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ledgerAPI, ledgerNoteAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Phone, Mail, MapPin, TrendingUp, Receipt, AlertCircle,
  Printer, Download, Share2, FileSpreadsheet, Search, Filter, X,
  Calendar, StickyNote, Plus, CreditCard, ShoppingCart, DollarSign,
  Clock, BarChart3, Target, CheckCircle, XCircle, HelpCircle,
} from 'lucide-react';

const CustomerLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchRef, setSearchRef] = useState('');
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [activeTab, setActiveTab] = useState('ledger');

  useEffect(() => {
    const load = async () => {
      try {
        const [ledgerRes, noteRes] = await Promise.allSettled([
          ledgerAPI.getCustomer(id),
          ledgerNoteAPI.get('customer', id),
        ]);
        if (ledgerRes.status === 'fulfilled') setData(ledgerRes.value.data);
        else toast.error('Failed to load ledger');
        if (noteRes.status === 'fulfilled') setNote(noteRes.value.data.note || '');
      } catch { toast.error('Failed to load ledger'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const saveNote = async () => {
    try {
      await ledgerNoteAPI.save('customer', id, note);
      toast.success('Note saved');
      setShowNoteInput(false);
    } catch { toast.error('Failed to save note'); }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const rows = filteredEntries.map((e, i) => {
      const balClass = e.balance > 0 ? 'color:#dc2626' : 'color:#059669';
      return `<tr${i % 2 === 0 ? '' : ' style="background:#f9fafb"'}>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">${formatDate(e.date)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:500">${e.type}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">${e.reference}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#dc2626">${e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#059669">${e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;${balClass}">${formatCurrency(e.balance)}</td>
      </tr>`;
    }).join('');
    w.document.write(`
      <html><head><title>Ledger - ${data.customer.name}</title>
      <style>
        @page{margin:12mm;size:A4}
        *{box-sizing:border-box}
        body{font-family:Inter,system-ui,sans-serif;margin:0;padding:0;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #e5e7eb;margin-bottom:20px}
        .info h1{font-size:20px;margin:0}
        .info p{font-size:12px;color:#6b7280;margin:4px 0 0}
        .balance{text-align:right}
        .balance .lbl{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}
        .balance .val{font-size:22px;font-weight:700}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;background:#f9fafb}
        th.right{text-align:right}
        .summary{display:flex;gap:16px;margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb}
        .summary > div{flex:1}
        .summary .lbl{font-size:11px;color:#6b7280}
        .summary .val{font-size:16px;font-weight:700;margin:2px 0 0}
        .footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb}
      </style></head><body>
      <div class="header">
        <div class="info">
          <h1>${data.customer.name}</h1>
          <p>${data.customer.phone || ''}${data.customer.phone && data.customer.email ? ' | ' : ''}${data.customer.email || ''}</p>
        </div>
        <div class="balance">
          <div class="lbl">Current Balance</div>
          <div class="val" style="color:${data.outstandingDue > 0 ? '#dc2626' : '#059669'}">${formatCurrency(data.outstandingDue)}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Type</th><th>Reference</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <div><div class="lbl">Opening Balance</div><div class="val">${formatCurrency(data.openingBalance)}</div></div>
        <div><div class="lbl">Total Sales</div><div class="val">${formatCurrency(data.totalSales)}</div></div>
        <div><div class="lbl">Total Received</div><div class="val">${formatCurrency(data.totalPayments)}</div></div>
        <div><div class="lbl">Outstanding Due</div><div class="val" style="color:${data.outstandingDue > 0 ? '#dc2626' : '#059669'}">${formatCurrency(data.outstandingDue)}</div></div>
      </div>
      <div class="footer">Generated by Vyapar Business Solutions</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const printContent = `
        <html><head><title>Ledger - ${data.customer.name}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}.total{font-weight:bold;background:#f0f0f0}</style>
        </head><body>
        <h2>Customer Ledger: ${data.customer.name}</h2>
        <p>Phone: ${data.customer.phone || '-'} | Email: ${data.customer.email || '-'}</p>
        <p>Outstanding Due: ${formatCurrency(data.outstandingDue)}</p>
        <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
        ${filteredEntries.map(e => `<tr><td>${formatDate(e.date)}</td><td>${e.type}</td><td>${e.reference || '-'}</td><td>${e.debit > 0 ? formatCurrency(e.debit) : '-'}</td><td>${e.credit > 0 ? formatCurrency(e.credit) : '-'}</td><td>${formatCurrency(e.balance)}</td></tr>`).join('')}
        </tbody></table>
        <p style="margin-top:20px;font-size:12px;color:#666">Generated on ${new Date().toLocaleDateString('en-IN')}</p>
        </body></html>`;
      const w = window.open('', '_blank');
      w.document.write(printContent);
      w.document.close();
      w.print();
    } catch { toast.error('Failed to generate PDF'); }
  };

  const handleExportExcel = () => {
    const headers = ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance'];
    const rows = filteredEntries.map(e => [
      formatDate(e.date), e.type, e.reference,
      e.debit > 0 ? formatCurrency(e.debit) : '',
      e.credit > 0 ? formatCurrency(e.credit) : '',
      formatCurrency(e.balance),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ledger-${data.customer.name}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel exported');
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Ledger - ${data.customer.name}`, text: `Customer Ledger: ${data.customer.name}\nBalance: ${formatCurrency(data.outstandingDue)}` });
      } else {
        toast.info('Share not supported on this browser');
      }
    } catch {}
  };

  const filteredEntries = useMemo(() => {
    const entries = data?.entries || [];
    let result = entries;
    if (dateRange.from) result = result.filter(e => new Date(e.date) >= new Date(dateRange.from));
    if (dateRange.to) result = result.filter(e => new Date(e.date) <= new Date(dateRange.to + 'T23:59:59'));
    if (typeFilter !== 'all') result = result.filter(e => e.type === typeFilter);
    if (searchRef) result = result.filter(e => (e.reference || '').toLowerCase().includes(searchRef.toLowerCase()));
    return result;
  }, [data, dateRange, typeFilter, searchRef]);

  const typeOptions = useMemo(() => {
    const types = [...new Set((data?.entries || []).map(e => e.type))];
    return types;
  }, [data]);

  const entryTypeIcon = (type) => {
    if (type === 'Opening Balance') return <HelpCircle className="w-3.5 h-3.5" />;
    if (type === 'Invoice') return <ShoppingCart className="w-3.5 h-3.5" />;
    if (type === 'Payment Received') return <CreditCard className="w-3.5 h-3.5" />;
    return <DollarSign className="w-3.5 h-3.5" />;
  };

  const entryTypeColor = (type) => {
    if (type === 'Opening Balance') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    if (type === 'Invoice') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    if (type === 'Payment Received') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-16 text-gray-400">Ledger not found</div>;

  const balanceColor = data.outstandingDue === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const dueStatusBadge = data.outstandingDue === 0
    ? { label: 'Settled', class: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800' }
    : data.outstandingDue < data.totalSales * 0.5
    ? { label: 'Partial', class: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' }
    : { label: 'Overdue', class: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button onClick={() => navigate('/customers')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="inline-flex items-center gap-2 px-3.5 py-2 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-3.5 py-2 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleShare} className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Customer Info + Closing Balance */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl"><User className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.customer.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Opening Balance: {formatCurrency(data.openingBalance)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
            {data.customer.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {data.customer.phone}</span>}
            {data.customer.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {data.customer.email}</span>}
            {data.customer.address && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {data.customer.address}</span>}
          </div>
        </div>
        <div className="sm:w-56 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Balance</p>
          <p className={`text-2xl font-bold mt-1 ${balanceColor}`}>{formatCurrency(data.outstandingDue)}</p>
          <span className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${dueStatusBadge.class}`}>
            {dueStatusBadge.label === 'Settled' ? <CheckCircle className="w-3 h-3" /> : dueStatusBadge.label === 'Partial' ? <AlertCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {dueStatusBadge.label}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Opening Balance</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(data.openingBalance)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Total Sales</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(data.totalSales)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Total Received</p><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalPayments)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg"><AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" /></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Outstanding Due</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(data.outstandingDue)}</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'ledger' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-slate-100 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Ledger Table
        </button>
        <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'timeline' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-slate-100 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Timeline
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'analytics' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-slate-100 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Analytics
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} className="px-3 py-1.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} className="px-3 py-1.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100">
                <option value="all">All Types</option>
                {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={searchRef} onChange={e => setSearchRef(e.target.value)} placeholder="Search by reference..." className="w-full pl-8 pr-3 py-1.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg text-xs bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-gray-400" />
              {searchRef && <button onClick={() => setSearchRef('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700">
                  <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Reference</th>
                  <th className="px-5 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Debit</th>
                  <th className="px-5 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Credit</th>
                  <th className="px-5 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {filteredEntries.map((e, i) => (
                  <tr key={i} className={`${e.type === 'Opening Balance' ? 'bg-gray-50/50 dark:bg-gray-700/30 font-medium' : 'hover:bg-gray-50/30 dark:hover:bg-gray-700/30'} transition-colors`}>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${entryTypeColor(e.type)}`}>
                        {entryTypeIcon(e.type)} {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{e.reference}</td>
                    <td className={`px-5 py-3 text-right font-medium ${e.debit > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                    <td className={`px-5 py-3 text-right font-medium ${e.credit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${e.balance > 0 ? 'text-red-600 dark:text-red-400' : e.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {formatCurrency(e.balance)}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">No matching entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Transaction Timeline</h3>
          <div className="space-y-0">
            {[...filteredEntries].reverse().map((e, i) => (
              <div key={i} className="flex gap-4 pb-4 relative">
                {i < filteredEntries.length - 1 && <div className="absolute left-[17px] top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600" />}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${entryTypeColor(e.type)}`}>
                  {entryTypeIcon(e.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${e.type === 'Payment Received' ? 'text-emerald-700 dark:text-emerald-300' : e.type === 'Invoice' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
                      {e.type}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(e.date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ref: {e.reference} &middot; {e.debit > 0 ? `${formatCurrency(e.debit)} debited` : ''}{e.credit > 0 ? `${formatCurrency(e.credit)} credited` : ''}
                  </p>
                </div>
              </div>
            ))}
            {filteredEntries.length === 0 && (
              <p className="text-center py-8 text-gray-400">No transactions found</p>
            )}
          </div>
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'analytics' && data.analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg"><Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Transaction</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.analytics.lastTransactionDate ? formatDate(data.analytics.lastTransactionDate) : 'N/A'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg"><BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Transactions</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatNumber(data.analytics.totalTransactions)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg"><Target className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Transaction</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(data.analytics.averageTransactionValue)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pink-50 dark:bg-pink-900/30 rounded-lg"><TrendingUp className="w-4 h-4 text-pink-600 dark:text-pink-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Largest Transaction</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(data.analytics.largestTransaction)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Invoices</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatNumber(data.analytics.invoiceCount)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payments Received</p>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatNumber(data.analytics.paymentCount)}</p>
          </div>
        </div>
      )}

      {/* Ledger Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ledger Notes</h3>
          </div>
          <button onClick={() => setShowNoteInput(!showNoteInput)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">
            {showNoteInput ? 'Cancel' : <><Plus className="w-3.5 h-3.5" /> Add Note</>}
          </button>
        </div>
        {showNoteInput && (
          <div className="space-y-3">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Customer promised payment next week." className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowNoteInput(false); ledgerNoteAPI.get('customer', id).then(r => setNote(r.data.note || '')).catch(() => {}); }} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button onClick={saveNote} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Note</button>
            </div>
          </div>
        )}
        {!showNoteInput && note && (
          <div className="bg-slate-50 dark:bg-gray-700/50 rounded-lg p-3 border border-slate-100 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note}</p>
          </div>
        )}
        {!showNoteInput && !note && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No notes added yet. Notes sync across all your devices.</p>
        )}
      </div>
    </motion.div>
  );
};

export default CustomerLedger;
