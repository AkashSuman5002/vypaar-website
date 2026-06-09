import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { saleAPI, settingAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Modal from '../components/UI/Modal';
import Badge from '../components/UI/Badge';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate, numberToWords } from '../utils/format';
import { motion } from 'framer-motion';
import { Printer, ArrowLeft, Share2, Download, Banknote, Building2, Phone, Mail, MapPin, BadgePercent, Landmark, QrCode, Edit3, Copy, RotateCcw, Truck, MessageSquare, Trash2, FileText, ChevronDown } from 'lucide-react';

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
];

const ViewSale = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');

  useEffect(() => {
    const load = async () => {
      try {
        const [saleRes, settingsRes] = await Promise.all([
          saleAPI.getById(id),
          settingAPI.get().catch(() => null),
        ]);
        setSale(saleRes.data);
        setSettings(settingsRes?.data || null);
      } catch { toast.error('Failed to load invoice'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-area');
    if (!printContent) return;
    const original = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    document.title = `Invoice ${sale.invoiceNumber}`;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await saleAPI.getPDF(sale._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${sale.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  const handleShare = async () => {
    try {
      const res = await saleAPI.getPDF(sale._id);
      const file = new File([res.data], `${sale.invoiceNumber}.pdf`, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${sale.invoiceNumber}` });
      } else {
        handleDownloadPDF();
      }
    } catch { toast.error('Failed to share invoice'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!sale) return <div className="text-center py-16 text-slate-400 dark:text-slate-500">Invoice not found</div>;

  const statusVariant = sale.paymentStatus === 'paid' ? 'paid' : sale.paymentStatus === 'partial' ? 'partial' : 'unpaid';
  const statusLabel = sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid';
  const statusColorsMap = {
    paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    partial: 'bg-amber-100 text-amber-800 border-amber-300',
    unpaid: 'bg-red-100 text-red-800 border-red-300',
  };

  const summaryItems = [];
  let runningTotal = 0;
  sale.items.forEach((item) => {
    const taxable = item.taxableAmount || item.amount;
    const cgst = item.cgst || 0;
    const sgst = item.sgst || 0;
    const total = taxable + cgst + sgst;
    runningTotal += total;
    summaryItems.push({ taxable, cgst, sgst, total });
  });

  const prefs = settings?.preferences || {};
  const printPrefs = prefs.print || {};
  const currencyPref = prefs.general?.businessCurrency || 'INR';
  const decimalPref = parseInt(prefs.general?.amountDecimalPlaces || '0');
  const fmt = (amt) => formatCurrency(amt, currencyPref, decimalPref);
  const showTime = prefs.transaction?.addTimeOnTransactions;
  const formatDateOrTime = (d) => {
    if (!d) return '';
    if (!showTime) return formatDate(d);
    return new Date(d).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 16;
  const invoiceHeadingSize = parseInt(printPrefs.invoiceTextSize) || 14;

  const bizLogo = settings?.logo ? `http://localhost:5000/${settings.logo}` : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[210mm] mx-auto">
      {/* Action Bar - hidden during print */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <button onClick={() => navigate('/sales')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {sale.paymentStatus !== 'paid' && sale.type === 'invoice' && (
            <button onClick={() => { setPayAmount(sale.remainingBalance); setPayMethod(sale.paymentMethod || 'cash'); setShowPayment(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
              <Banknote className="w-4 h-4" /> Receive
            </button>
          )}
          {sale.type === 'estimate' && sale.status !== 'cancelled' && (
            <button onClick={async () => {
              try { await saleAPI.convertToInvoice(sale._id); toast.success('Invoice created'); navigate('/sales'); }
              catch { toast.error('Failed'); }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Convert to Invoice
          </button>
          )}
          {sale.type === 'order' && sale.status !== 'cancelled' && (
            <button onClick={async () => {
              try { await saleAPI.convertToInvoice(sale._id); toast.success('Invoice created'); navigate('/sales'); }
              catch { toast.error('Failed'); }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Convert to Invoice
          </button>
          )}
          {sale.type === 'proforma' && sale.status !== 'cancelled' && (
            <button onClick={async () => {
              try { await saleAPI.convertToInvoice(sale._id); toast.success('Invoice created'); navigate('/sales'); }
              catch { toast.error('Failed'); }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Convert to Invoice
          </button>
          )}
          {sale.type === 'challan' && sale.status !== 'cancelled' && (
            <button onClick={async () => {
              try { await saleAPI.convertToInvoice(sale._id); toast.success('Invoice created'); navigate('/sales'); }
              catch { toast.error('Failed'); }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Convert to Invoice
          </button>
          )}
          <Link to={`/sales/${sale._id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
            <Edit3 className="w-4 h-4" /> Edit
          </Link>
          <button onClick={async () => {
            try { await saleAPI.duplicate(sale._id); toast.success('Duplicated'); navigate('/sales'); }
            catch { toast.error('Failed'); }
          }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            <Copy className="w-4 h-4" /> Duplicate
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="inline-flex items-center gap-1.5 px-3 py-2 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => {
            const msg = `*Invoice ${sale.invoiceNumber}*\nAmount: ${formatCurrency(sale.totalAmount)}\nStatus: ${sale.paymentStatus}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={() => {
            if (!window.confirm('Cancel this invoice?')) return;
            saleAPI.delete(sale._id).then(() => { toast.success('Cancelled'); navigate('/sales'); }).catch(() => toast.error('Failed'));
          }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <div className="relative">
            <button onClick={() => setShowActions(!showActions)} className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              More <ChevronDown className="w-3 h-3" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg py-1 min-w-[200px]" onMouseLeave={() => setShowActions(false)}>
                <button onClick={async () => {
                  try { await saleAPI.convertToChallan(sale._id); toast.success('Delivery Challan created'); navigate('/sales'); }
                  catch { toast.error('Failed'); }
                }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><Truck className="w-3.5 h-3.5" /> Convert to Challan</button>
                <button onClick={async () => {
                  if (!window.confirm('Create a credit note from this invoice?')) return;
                  try { await saleAPI.convertToReturn(sale._id); toast.success('Credit Note created'); navigate('/sales'); }
                  catch { toast.error('Failed'); }
                }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><RotateCcw className="w-3.5 h-3.5" /> Convert to Return</button>
                <button onClick={async () => {
                  try { await saleAPI.convertToEstimate(sale._id); toast.success('Estimate created'); navigate('/sales'); }
                  catch { toast.error('Failed'); }
                }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700"><FileText className="w-3.5 h-3.5" /> Convert to Estimate</button>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <div id="invoice-print-area" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden print:shadow-none print:rounded-none print:border-none">
        <div className="p-6 sm:p-8 md:p-10 print:p-6">

          {/* HEADER */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b-2 border-gray-100 dark:border-gray-700 print:border-gray-300 mb-6">
            <div className="flex items-start gap-4">
              {bizLogo && (
                <img src={bizLogo} alt="Logo" className="w-14 h-14 object-contain rounded-lg border border-gray-100 dark:border-gray-700 print:border-gray-300" />
              )}
              <div>
                <h1 className="font-bold text-slate-900 dark:text-slate-100 print:text-gray-900" style={{ fontSize: `${companyNameSize + 4}px` }}>{settings?.businessName || 'Your Business'}</h1>
                {settings?.address && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-1 max-w-xs leading-relaxed">{settings.address}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                  {settings?.phone && <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 print:text-gray-600"><Phone className="w-3 h-3" /> {settings.phone}</span>}
                  {settings?.email && <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 print:text-gray-600"><Mail className="w-3 h-3" /> {settings.email}</span>}
                </div>
                {settings?.gstNumber && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-1"><BadgePercent className="w-3 h-3 inline mr-1" />GST: {settings.gstNumber}</p>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className={`inline-block px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider border ${statusColorsMap[statusVariant]} print:${statusVariant === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : statusVariant === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                {statusLabel}
              </div>
              <h2 className="font-bold text-blue-600 dark:text-blue-400 print:text-blue-700 mt-3" style={{ fontSize: `${invoiceHeadingSize + 4}px` }}>{sale.type === 'invoice' ? 'TAX INVOICE' : sale.type === 'estimate' ? 'ESTIMATE' : sale.type === 'quotation' ? 'QUOTATION' : sale.type === 'proforma' ? 'PROFORMA INVOICE' : sale.type === 'order' ? 'SALE ORDER' : sale.type === 'challan' ? 'DELIVERY CHALLAN' : sale.type === 'credit_note' ? 'CREDIT NOTE' : 'DOCUMENT'}</h2>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900"><span className="text-slate-500 dark:text-slate-400 print:text-gray-600">Invoice: </span><span className="font-semibold">{sale.invoiceNumber}</span></p>
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900"><span className="text-slate-500 dark:text-slate-400 print:text-gray-600">Date: </span><span className="font-semibold">{formatDateOrTime(sale.date)}</span></p>
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900"><span className="text-slate-500 dark:text-slate-400 print:text-gray-600">Due Date: </span><span className="font-semibold">{formatDateOrTime(sale.date)}</span></p>
                {sale.isRecurringTemplate && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Recurring Invoice</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Frequency: {sale.recurringFrequency || 'monthly'}{sale.recurringMaxCount ? ` · Max: ${sale.recurringMaxCount}` : ''}{sale.recurringCount ? ` · Done: ${sale.recurringCount}` : ''}</p>
                    {sale.recurringNextDate && <p className="text-xs text-blue-600 dark:text-blue-400">Next: {formatDateOrTime(sale.recurringNextDate)}</p>}
                  </div>
                )}
                {sale.isRecurring && !sale.isRecurringTemplate && sale.recurringIndex && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Recurring #{sale.recurringIndex}</p>
                )}
              </div>
            </div>
          </div>

          {/* BILL TO */}
          {sale.customer && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 print:text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
              <div className="border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-700/30">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 print:text-gray-900">{sale.customerName || 'Walk-in Customer'}</p>
                {sale.customer?.phone && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-1"><Phone className="w-3 h-3 inline mr-1" />{sale.customer.phone}</p>}
                {sale.customer?.email && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5"><Mail className="w-3 h-3 inline mr-1" />{sale.customer.email}</p>}
                {sale.customer?.address && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{sale.customer.address}</p>}
                {prefs.party?.printShippingAddress && sale.shippingAddress && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 print:border-gray-300">
                    <p className="text-2xs font-semibold text-gray-400 dark:text-gray-500 print:text-gray-500 uppercase tracking-wider">Ship To</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{sale.shippingAddress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRODUCT TABLE */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-200 dark:border-gray-700 print:border-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-8">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider">Product</th>
                  {printPrefs.printDescription !== false && <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-32">Description</th>}
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-14">Qty</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-20">Rate</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-16">GST%</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-20">Taxable</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-16">CGST</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-16">SGST</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-300">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-700/20'} print:${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 print:text-gray-600 text-center">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 text-sm">{item.productName}</span>
                    </td>
                    {printPrefs.printDescription !== false && <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 print:text-gray-600">{item.description || '-'}</td>}
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300 print:text-gray-800">{item.quantity}</td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300 print:text-gray-800 font-medium">{fmt(item.rate)}</td>
                    <td className="px-3 py-3 text-right text-blue-600 dark:text-blue-400 print:text-blue-700 font-medium">{item.gstRate ? `${item.gstRate}%` : '-'}</td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300 print:text-gray-800">{fmt(item.taxableAmount || item.amount)}</td>
                    <td className="px-3 py-3 text-right text-blue-600 dark:text-blue-400 print:text-blue-700">{item.cgst ? fmt(item.cgst) : '-'}</td>
                    <td className="px-3 py-3 text-right text-blue-600 dark:text-blue-400 print:text-blue-700">{item.sgst ? fmt(item.sgst) : '-'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-slate-100 print:text-gray-900">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUMMARY + PAYMENT */}
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="flex-1">
              {/* Amount in Words */}
              {printPrefs.amountInWords !== false && (
              <div className="border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-700/30">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider mb-1.5">Amount In Words</h3>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 print:text-gray-900">{numberToWords(sale.totalAmount)}</p>
              </div>
              )}
            </div>
            <div className="w-full sm:w-64">
              <div className="border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {printPrefs.youSaved !== false && (sale.discountTotal > 0 || sale.discountOnInvoice > 0) && (
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-medium">You Saved</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-700">{fmt((sale.discountTotal || 0) + (sale.discountOnInvoice || 0))}</td>
                    </tr>
                    )}
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-gray-600">Subtotal</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100 print:text-gray-900">{fmt(sale.taxableAmount || sale.totalAmount)}</td>
                    </tr>
                    {printPrefs.taxDetails !== false && <><tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-gray-600">CGST</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-600 dark:text-blue-400 print:text-blue-700">{fmt(sale.cgstTotal || 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-gray-600">SGST</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-600 dark:text-blue-400 print:text-blue-700">{fmt(sale.sgstTotal || 0)}</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-gray-600">Total GST</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-600 dark:text-blue-400 print:text-blue-700">{fmt((sale.cgstTotal || 0) + (sale.sgstTotal || 0))}</td>
                    </tr></>}
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 print:text-gray-900">Grand Total</td>
                      <td className="px-4 py-3 text-right text-base font-bold text-slate-900 dark:text-slate-100 print:text-gray-900">{fmt(sale.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Summary */}
              <div className={`grid gap-3 mt-3 ${printPrefs.balanceAmount !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 print:border-emerald-300 rounded-xl p-3">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-medium">Paid</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 print:text-emerald-800 mt-0.5">{fmt(sale.paidAmount)}</p>
                </div>
                {printPrefs.balanceAmount !== false && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 print:border-amber-300 rounded-xl p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 print:text-amber-700 font-medium">Balance</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 print:text-amber-800 mt-0.5">{fmt(sale.remainingBalance)}</p>
                </div>
                )}
              </div>

              {printPrefs.paymentMode !== false && sale.paymentMethod && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 text-right capitalize">
                  Payment Method: <span className="font-medium text-slate-700 dark:text-slate-300 print:text-gray-800">{sale.paymentMethod}</span>
                </div>
              )}
            </div>
          </div>

          {/* BANK DETAILS (conditional) */}
          {settings?.bankName && (
            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Bank Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {settings.bankName && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">Bank</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankName}</p></div>}
                {(settings.bankAccountNumber || settings.accountNumber) && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">A/C No.</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankAccountNumber || settings.accountNumber}</p></div>}
                {(settings.bankIfsc || settings.ifscCode) && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">IFSC</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankIfsc || settings.ifscCode}</p></div>}
                {settings.upiId && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">UPI ID</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5 flex items-center gap-1"><QrCode className="w-3 h-3" />{settings.upiId}</p></div>}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300 pt-6">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900 font-medium">Thank you for your business!</p>
                {printPrefs.signature !== false && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">Authorized Signature</p>
                  <div className="mt-2 w-40 border-t border-gray-300 dark:border-gray-600 pt-2">
                    <div className="h-8" />
                  </div>
                </div>
                )}
                {printPrefs.receivedBy !== false && (
                <div className="mt-4 grid grid-cols-2 gap-4 max-w-xs">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">Received By</p>
                    <div className="mt-1 border-b border-gray-300 dark:border-gray-600 h-6" />
                  </div>
                  {printPrefs.deliveredBy !== false && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">Delivered By</p>
                    <div className="mt-1 border-b border-gray-300 dark:border-gray-600 h-6" />
                  </div>
                  )}
                </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                {printPrefs.termsConditions !== false && (
                <>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider">Terms & Conditions</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500 mt-1 max-w-xs sm:ml-auto leading-relaxed">
                  {sale.termsConditions || 'Goods once sold will not be taken back. Payment is due on or before the due date. Interest will be charged on late payments.'}
                </p>
                </>
                )}
                {printPrefs.footerSettings !== false && (
                <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500 mt-4">Generated by Vyapar Business Solutions</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Receive Payment Modal - unchanged */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Receive Payment">
        <div className="bg-slate-50 dark:bg-gray-700 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Invoice</span><span className="font-medium text-slate-900 dark:text-slate-100">{sale.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Customer</span><span className="font-medium text-slate-900 dark:text-slate-100">{sale.customerName || 'Walk-in'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total</span><span className="font-medium text-slate-900 dark:text-slate-100">{fmt(sale.totalAmount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Already Paid</span><span className="font-medium text-emerald-600 dark:text-emerald-400">{fmt(sale.paidAmount)}</span></div>
          <div className="flex justify-between border-t border-slate-200/80 dark:border-gray-700/80 pt-1.5"><span className="text-slate-500 dark:text-slate-400">Due</span><span className="font-bold text-red-600 dark:text-red-400">{fmt(sale.remainingBalance)}</span></div>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (payAmount <= 0) return toast.error('Enter a valid amount');
          try {
            const newPaid = sale.paidAmount + Number(payAmount);
            await saleAPI.update(sale._id, { paidAmount: newPaid, paymentMethod: payMethod });
            toast.success('Payment received');
            const { data } = await saleAPI.getById(sale._id);
            setSale(data);
            setShowPayment(false);
          } catch { toast.error('Failed to update payment'); }
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Amount</label>
            <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} max={sale.remainingBalance} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
              {paymentMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowPayment(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">Confirm Payment</button>
          </div>
        </form>
      </Modal>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 10mm; size: ${printPrefs.paperSize || 'A4'} ${printPrefs.orientation === 'Landscape' ? 'landscape' : 'portrait'}; }
          .no-print { display: none !important; }
          #invoice-print-area { box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: 100% !important; }
          #invoice-print-area .print\\:text-gray-900 { color: #111827 !important; }
          #invoice-print-area .print\\:text-gray-600 { color: #4b5563 !important; }
          #invoice-print-area .print\\:text-gray-500 { color: #6b7280 !important; }
          #invoice-print-area .print\\:text-gray-800 { color: #1f2937 !important; }
          #invoice-print-area .print\\:text-blue-700 { color: #1d4ed8 !important; }
          #invoice-print-area .print\\:text-emerald-700 { color: #047857 !important; }
          #invoice-print-area .print\\:text-emerald-800 { color: #065f46 !important; }
          #invoice-print-area .print\\:text-amber-700 { color: #a16207 !important; }
          #invoice-print-area .print\\:text-amber-800 { color: #854d0e !important; }
          #invoice-print-area .print\\:bg-gray-50 { background-color: #f9fafb !important; }
          #invoice-print-area .print\\:border-gray-300 { border-color: #d1d5db !important; }
          #invoice-print-area .print\\:border-emerald-300 { border-color: #6ee7b7 !important; }
          #invoice-print-area .print\\:border-amber-300 { border-color: #fcd34d !important; }
          #invoice-print-area .print\\:shadow-none { box-shadow: none !important; }
          #invoice-print-area .print\\:rounded-none { border-radius: 0 !important; }
          #invoice-print-area .print\\:border-none { border: none !important; }
          #invoice-print-area .print\\:divide-gray-300 > :not([hidden]) ~ :not([hidden]) { border-color: #d1d5db !important; }
        }
      `}</style>
    </motion.div>
  );
};

export default ViewSale;
