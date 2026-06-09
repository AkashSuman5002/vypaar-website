import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { saleAPI, settingAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate, numberToWords } from '../utils/format';
import { motion } from 'framer-motion';
import { Printer, ArrowLeft, Download, Phone, Mail, MapPin, BadgePercent, Landmark, QrCode, Edit3, Copy, MessageSquare, Trash2, FileText, ChevronDown } from 'lucide-react';

const ViewProforma = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [saleRes, settingsRes] = await Promise.all([
          saleAPI.getById(id),
          settingAPI.get().catch(() => null),
        ]);
        setSale(saleRes.data);
        setSettings(settingsRes?.data || null);
      } catch { toast.error('Failed to load proforma invoice'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-area');
    if (!printContent) return;
    const original = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    document.title = `Proforma ${sale.invoiceNumber}`;
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

  if (loading) return <LoadingSpinner />;
  if (!sale) return <div className="text-center py-16 text-slate-400 dark:text-slate-500">Proforma invoice not found</div>;

  const prefs = settings?.preferences || {};
  const printPrefs = prefs.print || {};
  const currencyPref = prefs.general?.businessCurrency || 'INR';
  const decimalPref = parseInt(prefs.general?.amountDecimalPlaces || '0');
  const showTime = prefs.transaction?.addTimeOnTransactions;
  const formatDateOrTime = (d) => {
    if (!d) return '';
    if (!showTime) return formatDate(d);
    return new Date(d).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 16;
  const invoiceHeadingSize = parseInt(printPrefs.invoiceTextSize) || 14;
  const fmt = (amt) => formatCurrency(amt, currencyPref, decimalPref);
  const bizLogo = settings?.logo ? `http://localhost:5000/${settings.logo}` : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[210mm] mx-auto">
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <button onClick={() => navigate('/sales/proforma')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Proforma
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {sale.status !== 'cancelled' && (
            <button onClick={async () => {
              try { await saleAPI.convertToInvoice(sale._id); toast.success('Invoice created'); navigate('/sales'); }
              catch { toast.error('Failed'); }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Convert to Invoice
          </button>
          )}
          <Link to={`/sales/proforma/${sale._id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
            <Edit3 className="w-4 h-4" /> Edit
          </Link>
          <button onClick={async () => {
            try { await saleAPI.duplicate(sale._id); toast.success('Duplicated'); navigate('/sales/proforma'); }
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
            const msg = `*Proforma Invoice ${sale.invoiceNumber}*\nAmount: ${formatCurrency(sale.totalAmount)}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
          <div className="relative">
            <button onClick={() => setShowActions(!showActions)} className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              More <ChevronDown className="w-3 h-3" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg py-1 min-w-[200px]" onMouseLeave={() => setShowActions(false)}>
                <button onClick={() => {
                  if (!window.confirm('Cancel this proforma invoice?')) return;
                  saleAPI.delete(sale._id).then(() => { toast.success('Cancelled'); navigate('/sales/proforma'); }).catch(() => toast.error('Failed'));
                }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Cancel Proforma</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="invoice-print-area" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden print:shadow-none print:rounded-none print:border-none">
        <div className="p-6 sm:p-8 md:p-10 print:p-6">
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
              <h2 className="font-bold text-indigo-600 dark:text-indigo-400 print:text-indigo-700 mt-3" style={{ fontSize: `${invoiceHeadingSize + 4}px` }}>PROFORMA INVOICE</h2>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900"><span className="text-slate-500 dark:text-slate-400 print:text-gray-600">Proforma: </span><span className="font-semibold">{sale.invoiceNumber}</span></p>
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900"><span className="text-slate-500 dark:text-slate-400 print:text-gray-600">Date: </span><span className="font-semibold">{formatDateOrTime(sale.date)}</span></p>
              </div>
            </div>
          </div>

          {sale.customer && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 print:text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
              <div className="border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-700/30">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 print:text-gray-900">{sale.customerName || 'Walk-in Customer'}</p>
                {sale.customer?.phone && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-1"><Phone className="w-3 h-3 inline mr-1" />{sale.customer.phone}</p>}
                {sale.customer?.email && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5"><Mail className="w-3 h-3 inline mr-1" />{sale.customer.email}</p>}
                {sale.customer?.address && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{sale.customer.address}</p>}
              </div>
            </div>
          )}

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-200 dark:border-gray-700 print:border-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider w-8">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider">Product</th>
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
                    <td className="px-3 py-3"><span className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 text-sm">{item.productName}</span></td>
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

          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="flex-1">
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
            </div>
          </div>

          {settings?.bankName && (
            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 print:border-gray-300 rounded-xl">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Bank Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {settings.bankName && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">Bank</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankName}</p></div>}
                {(settings.bankAccountNumber || settings.accountNumber) && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">A/C No.</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankAccountNumber || settings.accountNumber}</p></div>}
                {(settings.bankIfsc || settings.ifscCode) && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">IFSC</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5">{settings.bankIfsc || settings.ifscCode}</p></div>}
                {settings.upiId && <div><span className="text-gray-400 dark:text-gray-500 print:text-gray-500">UPI ID</span><p className="font-medium text-slate-900 dark:text-slate-100 print:text-gray-900 mt-0.5 flex items-center gap-1"><QrCode className="w-3 h-3" />{settings.upiId}</p></div>}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300 pt-6">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <p className="text-sm text-slate-900 dark:text-slate-100 print:text-gray-900 font-medium">Thank you for your business!</p>
                {printPrefs.signature !== false && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">Authorized Signature</p>
                  <div className="mt-2 w-40 border-t border-gray-300 dark:border-gray-600 pt-2"><div className="h-8" /></div>
                </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                {printPrefs.termsConditions !== false && (
                <>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-600 uppercase tracking-wider">Terms & Conditions</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500 mt-1 max-w-xs sm:ml-auto leading-relaxed">{sale.termsConditions || 'This is a proforma invoice and not a final bill.'}</p>
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

      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 10mm; size: ${printPrefs.paperSize || 'A4'} ${printPrefs.orientation === 'Landscape' ? 'landscape' : 'portrait'}; }
          .no-print { display: none !important; }
          #invoice-print-area { box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </motion.div>
  );
};

export default ViewProforma;
