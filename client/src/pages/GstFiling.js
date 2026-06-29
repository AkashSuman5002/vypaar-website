import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { FileText, Download, CheckCircle, Loader2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { gstFilingAPI } from '../services/api';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const GstFiling = () => {
  const [activeTab, setActiveTab] = useState('gstr1');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr2Data, setGstr2Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [filings, setFilings] = useState([]);
  const [filingsLoading, setFilingsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchGSTR1 = useCallback(async () => {
    try { setLoading(true); const { data } = await gstFilingAPI.getGSTR1({ month, year }); setGstr1Data(data); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to fetch GSTR-1 data'); }
    finally { setLoading(false); }
  }, [month, year]);

  const fetchGSTR2 = useCallback(async () => {
    try { setLoading(true); const { data } = await gstFilingAPI.getGSTR2({ month, year }); setGstr2Data(data); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to fetch GSTR-2 data'); }
    finally { setLoading(false); }
  }, [month, year]);

  const fetchGSTR3B = useCallback(async () => {
    try { setLoading(true); const { data } = await gstFilingAPI.getGSTR3B({ month, year }); setGstr3bData(data); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to fetch GSTR-3B data'); }
    finally { setLoading(false); }
  }, [month, year]);

  const fetchFilings = useCallback(async () => {
    try { setFilingsLoading(true); const { data } = await gstFilingAPI.getFilings(); setFilings(data.filings || []); }
    catch (err) { toast.error('Failed to fetch filing history'); }
    finally { setFilingsLoading(false); }
  }, []);

  useEffect(() => { fetchFilings(); }, [fetchFilings]);

  const handleFetchData = () => {
    if (activeTab === 'gstr1') fetchGSTR1();
    else if (activeTab === 'gstr2') fetchGSTR2();
    else if (activeTab === 'gstr3b') fetchGSTR3B();
  };

  const handleDownloadJSON = async () => {
    try {
      setDownloading(true);
      const { data } = await gstFilingAPI.prepareGSTR1({ month, year });
      if (data.gstr1) {
        const blob = new Blob([JSON.stringify(data.gstr1, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `GSTR1_${year}-${String(month).padStart(2, '0')}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); toast.success('GSTR-1 JSON downloaded');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to prepare GSTR-1 JSON'); }
    finally { setDownloading(false); }
  };

  const handleMarkFiled = async (filingId) => {
    try { await gstFilingAPI.markFiled(filingId, { referenceNumber: '' }); toast.success('Filing marked as filed'); fetchFilings(); }
    catch (err) { toast.error('Failed to mark as filed'); }
  };

  const tabs = [
    { key: 'gstr1', label: 'GSTR-1', desc: 'Outward Supplies' },
    { key: 'gstr2', label: 'GSTR-2', desc: 'Inward Supplies' },
    { key: 'gstr3b', label: 'GSTR-3B', desc: 'Summary Return' },
    { key: 'filings', label: 'Filing Status', desc: 'Track Filings' },
  ];

  const currentData = activeTab === 'gstr1' ? gstr1Data : activeTab === 'gstr2' ? gstr2Data : gstr3bData;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">GST Filing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Prepare and track GST returns (GSTR-1, GSTR-2, GSTR-3B)</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </motion.div>

      {activeTab !== 'filings' && (
        <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleFetchData} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Fetch Data
          </button>
          {activeTab === 'gstr1' && (
            <button onClick={handleDownloadJSON} disabled={downloading || !gstr1Data}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download JSON
            </button>
          )}
        </motion.div>
      )}

      {activeTab === 'filings' ? (
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
          {filingsLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : filings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No filings yet. Fetch GSTR-1 data to create a filing record.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    {['Period', 'Return Type', 'Status', 'Invoices', 'Taxable', 'Tax', 'Filed On', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filings.map(f => (
                    <tr key={f._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{f.period}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{f.returnType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                          f.status === 'filed' ? 'bg-emerald-50 text-emerald-700' :
                          f.status === 'prepared' ? 'bg-blue-50 text-blue-700' :
                          f.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{f.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{f.totalInvoices}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(f.totalTaxable)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(f.totalTax)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{f.filingDate ? formatDate(f.filingDate) : '—'}</td>
                      <td className="px-4 py-3">
                        {f.status !== 'filed' && (
                          <button onClick={() => handleMarkFiled(f._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Mark Filed</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      ) : currentData ? (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl"><FileText className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Period</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{currentData.period}</p></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl"><FileSpreadsheet className="w-5 h-5 text-indigo-600" /></div>
                <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoices</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{currentData.summary?.totalInvoices || 0}</p></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Taxable Value</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(currentData.summary?.totalTaxable || 0)}</p></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl"><FileText className="w-5 h-5 text-amber-600" /></div>
                <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tax</p><p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency((currentData.summary?.totalCGST || 0) + (currentData.summary?.totalSGST || 0) + (currentData.summary?.totalIGST || 0))}</p></div>
              </div>
            </div>
          </div>

          {activeTab === 'gstr1' && gstr1Data?.b2b?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">B2B Invoices ({gstr1Data.b2b.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100 dark:border-gray-700">
                    {['GSTIN', 'Invoice No', 'Date', 'Value', 'Place of Supply'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {gstr1Data.b2b.map((inv, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-100">{inv.gstin}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(inv.invoiceValue)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{inv.placeOfSupply}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'gstr1' && gstr1Data?.hsnSummary?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">HSN Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100 dark:border-gray-700">
                    {['HSN', 'Qty', 'Taxable', 'CGST', 'SGST', 'IGST'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {gstr1Data.hsnSummary.map((hsn, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-100">{hsn.hsn}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{hsn.qty}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(hsn.taxable)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(hsn.cgst)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(hsn.sgst)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(hsn.igst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'gstr3b' && gstr3bData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-6">
                <h3 className="text-sm font-semibold text-emerald-700 mb-4">Outward Supplies</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Taxable</span><span className="font-semibold">{formatCurrency(gstr3bData.outward?.taxable || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">CGST</span><span className="font-semibold">{formatCurrency(gstr3bData.outward?.cgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">SGST</span><span className="font-semibold">{formatCurrency(gstr3bData.outward?.sgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">IGST</span><span className="font-semibold">{formatCurrency(gstr3bData.outward?.igst || 0)}</span></div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-6">
                <h3 className="text-sm font-semibold text-blue-700 mb-4">Inward Supplies (ITC)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Taxable</span><span className="font-semibold">{formatCurrency(gstr3bData.inward?.taxable || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">CGST</span><span className="font-semibold">{formatCurrency(gstr3bData.inward?.cgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">SGST</span><span className="font-semibold">{formatCurrency(gstr3bData.inward?.sgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">IGST</span><span className="font-semibold">{formatCurrency(gstr3bData.inward?.igst || 0)}</span></div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-6">
                <h3 className="text-sm font-semibold text-amber-700 mb-4">Net Tax Payable</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">CGST</span><span className="font-semibold">{formatCurrency(gstr3bData.net?.cgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">SGST</span><span className="font-semibold">{formatCurrency(gstr3bData.net?.sgst || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">IGST</span><span className="font-semibold">{formatCurrency(gstr3bData.net?.igst || 0)}</span></div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Select a period and click "Fetch Data" to view GST return data.</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default GstFiling;
