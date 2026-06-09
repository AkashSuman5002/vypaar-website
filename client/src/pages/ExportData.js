import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, Download, Archive, FileText, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, X, Loader2, ChevronRight, Calendar, Table2, Settings2, Play, BarChart3, FileDown, Layers, Files, FolderOpen } from 'lucide-react';
import { toast } from 'react-toastify';
import { exportAPI } from '../services/api';

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  a.remove(); window.URL.revokeObjectURL(url);
};

const EXPORT_MODULES = [
  { key: 'Parties', label: 'Parties', icon: '👥', default: true },
  { key: 'Items', label: 'Items', icon: '📦', default: true },
  { key: 'Sales', label: 'Sales', icon: '🧾', default: true },
  { key: 'Purchases', label: 'Purchases', icon: '📋', default: true },
  { key: 'Expenses', label: 'Expenses', icon: '💰', default: true },
  { key: 'Stock', label: 'Stock', icon: '📊', default: true },
  { key: 'Customer Ledger', label: 'Customer Ledger', icon: '👤', default: false },
  { key: 'Supplier Ledger', label: 'Supplier Ledger', icon: '🏢', default: false },
  { key: 'Cash Transactions', label: 'Cash Transactions', icon: '💵', default: false },
  { key: 'Bank Transactions', label: 'Bank Transactions', icon: '🏦', default: false },
  { key: 'GST Data', label: 'GST Data', icon: '📑', default: false },
];

const REPORT_TYPES = [
  'Profit & Loss', 'Balance Sheet', 'Trial Balance', 'Cash Flow',
  'GST Reports', 'Party Reports', 'Stock Reports', 'Business Reports', 'Expense Reports',
];

const ExportData = () => {
  const [activeView, setActiveView] = useState('menu');
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState({});
  const [selectedModules, setSelectedModules] = useState(EXPORT_MODULES.filter(m => m.default).map(m => m.key));
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [financialYear, setFinancialYear] = useState('all');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTask, setImportTask] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [reportFormat, setReportFormat] = useState('xlsx');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    exportAPI.getCounts().then(r => setCounts(r.data)).catch(() => {});
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await exportAPI.getHistory({ limit: 10 });
      setHistory(res.data.histories || []);
    } catch {}
  };

  const toggleModule = (key) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExcelExport = async () => {
    if (selectedModules.length === 0) { toast.error('Select at least one module'); return; }
    setImporting(true); setStep(3); setImportProgress(0);
    try {
      const steps = ['Preparing data...', 'Generating spreadsheets...', 'Compressing files...', 'Finalizing...'];
      for (let i = 0; i < steps.length; i++) {
        setImportTask(steps[i]);
        setImportProgress((i + 1) * 25);
        await new Promise(r => setTimeout(r, 400));
      }
      const res = await exportAPI.excelExport({
        modules: selectedModules, format: exportFormat,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      const disposition = res.headers['content-disposition'];
      const match = disposition && disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const fileName = match ? match[1].replace(/['"]/g, '') : `export.${exportFormat === 'zip' ? 'zip' : exportFormat}`;
      downloadBlob(res.data, fileName);
      setImportProgress(100); setImportTask('Completed!');
      setImportResult({ success: true, fileName });
      setStep(4); toast.success('Export completed!');
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Export failed');
      setImportResult({ failed: true, errors: [e.message] });
      setStep(4);
    } finally { setImporting(false); }
  };

  const handleBackupExport = async () => {
    setImporting(true); setStep(3); setImportProgress(0);
    try {
      const steps = ['Collecting business data...', 'Serializing records...', 'Compressing backup...', 'Preparing download...'];
      for (let i = 0; i < steps.length; i++) {
        setImportTask(steps[i]);
        setImportProgress((i + 1) * 25);
        await new Promise(r => setTimeout(r, 500));
      }
      const res = await exportAPI.backupExport();
      downloadBlob(res.data, 'backup.zip');
      setImportProgress(100); setImportTask('Completed!');
      setImportResult({ success: true, fileName: 'backup.zip' });
      setStep(4); toast.success('Backup created!');
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Backup failed');
      setImportResult({ failed: true, errors: [e.message] });
      setStep(4);
    } finally { setImporting(false); }
  };

  const handleReportExport = async () => {
    setImporting(true); setStep(3); setImportProgress(0);
    try {
      const steps = ['Generating report...', 'Formatting data...', 'Preparing download...'];
      for (let i = 0; i < steps.length; i++) {
        setImportTask(steps[i]);
        setImportProgress((i + 1) * 33);
        await new Promise(r => setTimeout(r, 400));
      }
      const res = await exportAPI.reportExport({
        reportType, format: reportFormat,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      });
      const disposition = res.headers['content-disposition'];
      const match = disposition && disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const fileName = match ? match[1].replace(/['"]/g, '') : `${reportType.replace(/\s+/g, '_')}.${reportFormat}`;
      downloadBlob(res.data, fileName);
      setImportProgress(100); setImportTask('Completed!');
      setImportResult({ success: true, fileName });
      setStep(4); toast.success('Report exported!');
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Export failed');
      setImportResult({ failed: true, errors: [e.message] });
      setStep(4);
    } finally { setImporting(false); }
  };

  const renderMenu = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center">
          <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Export Data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Export your business data for backup, migration and reporting.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        <button onClick={() => { setActiveView('excel'); setStep(0); setImportResult(null); }} className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Export To Excel</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Export data into Excel files.</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg group-hover:bg-emerald-700 transition-colors"><FileDown className="w-4 h-4" /> Start Excel Export</span>
        </button>

        <button onClick={() => { setActiveView('backup'); setStep(0); setImportResult(null); }} className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 text-left hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Archive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Export Complete Backup</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Create a full backup of all business data.</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg group-hover:bg-indigo-700 transition-colors"><FolderOpen className="w-4 h-4" /> Create Backup</span>
        </button>

        <button onClick={() => { setActiveView('report'); setStep(0); setImportResult(null); }} className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 text-left hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-600 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Export Reports</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Export accounting reports and statements.</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg group-hover:bg-amber-700 transition-colors"><FileText className="w-4 h-4" /> Export Reports</span>
        </button>
      </div>

      {history.length > 0 && (
        <div className="max-w-4xl mx-auto mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Exports</h3>
            <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{showHistory ? 'Hide' : 'View All'}</button>
          </div>
          {showHistory && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">File</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Size</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {history.map(h => (
                    <tr key={h._id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 capitalize">{h.exportType}</span></td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{h.fileName}</td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{h.fileSize ? (h.fileSize / 1024).toFixed(1) + ' KB' : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => exportAPI.downloadHistory(h._id).then(r => downloadBlob(r.data, h.fileName)).catch(() => toast.error('File not found'))} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Download</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderExcelWizard = () => (
    <div className="p-6">
      <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Export Options</button>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Select Data to Export</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose which modules to include in the export.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
                {EXPORT_MODULES.map(mod => {
                  const selected = selectedModules.includes(mod.key);
                  const count = counts[mod.key.toLowerCase().replace(/\s+/g, '')] || counts[mod.key] || 0;
                  return (
                    <button key={mod.key} type="button" onClick={() => toggleModule(mod.key)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${selected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-700'}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-gray-600'}`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{mod.icon} {mod.label}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{count.toLocaleString()} records</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between max-w-3xl mx-auto">
                <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Filters <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center"><Calendar className="w-7 h-7 text-blue-600 dark:text-blue-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Filters & Format</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set date range and export format.</p>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Financial Year</label>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'current', 'custom'].map(fy => (
                      <button key={fy} onClick={() => setFinancialYear(fy)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${financialYear === fy ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-600 hover:border-blue-300'}`}>
                        {fy === 'all' ? 'All Data' : fy === 'current' ? 'Current FY' : 'Custom Range'}
                      </button>
                    ))}
                  </div>
                </div>
                {financialYear === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From Date</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm" /></div>
                    <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To Date</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm" /></div>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Export Format</label>
                <div className="flex gap-3">
                  {[
                    { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
                    { value: 'csv', label: 'CSV (.csv)', icon: FileText },
                    { value: 'zip', label: 'ZIP (.zip)', icon: Archive },
                  ].map(f => (
                    <button key={f.value} onClick={() => setExportFormat(f.value)} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${exportFormat === f.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-emerald-200'}`}>
                      <f.icon className={`w-6 h-6 ${exportFormat === f.value ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-medium ${exportFormat === f.value ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selected Modules</p>
                <div className="flex flex-wrap gap-2">
                  {selectedModules.map(m => <span key={m} className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg">{m}</span>)}
                </div>
                <p className="text-xs text-slate-400 mt-2">Total: {selectedModules.length} modules | Format: {exportFormat.toUpperCase()}</p>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Preview <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center"><Layers className="w-7 h-7 text-purple-600 dark:text-purple-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Preview Export</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review your export configuration.</p>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {selectedModules.map(key => {
                    const mod = EXPORT_MODULES.find(m => m.key === key);
                    const count = counts[key.toLowerCase().replace(/\s+/g, '')] || counts[key] || 0;
                    return (
                      <div key={key} className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
                        <span className="text-lg block mb-1">{mod?.icon || '📁'}</span>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{count.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{mod?.label || key}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-200 dark:border-gray-600 pt-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Format</span><span className="font-medium text-slate-700 dark:text-slate-300">{exportFormat.toUpperCase()}</span></div>
                  <div className="flex justify-between text-sm mt-1"><span className="text-slate-500 dark:text-slate-400">Estimated file</span><span className="font-medium text-slate-700 dark:text-slate-300">~{selectedModules.length} file{selectedModules.length > 1 ? 's' : ''}</span></div>
                  {dateFrom && <div className="flex justify-between text-sm mt-1"><span className="text-slate-500 dark:text-slate-400">Date Range</span><span className="font-medium text-slate-700 dark:text-slate-300">{dateFrom} to {dateTo || 'now'}</span></div>}
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleExcelExport} disabled={importing} className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-soft">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {importing ? 'Exporting...' : 'Start Export'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 space-y-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><Files className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Exporting Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while your data is being exported.</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{importTask}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importProgress}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${importProgress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" />
                </div>
                <div className="flex justify-center"><Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="p-6 space-y-6 max-w-lg mx-auto">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult?.failed ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
                  {importResult?.failed ? <AlertCircle className="w-8 h-8 text-amber-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{importResult?.failed ? 'Export Failed' : 'Export Completed Successfully'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{importResult?.fileName && `File: ${importResult.fileName}`}</p>
              </div>
              {importResult?.errors?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 max-h-32 overflow-y-auto">
                  {importResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">{e}</p>)}
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button onClick={() => setActiveView('menu')} className="px-5 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700">Done</button>
                <button onClick={() => { setStep(0); setImportResult(null); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Download className="w-4 h-4" /> Export More</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const renderBackupWizard = () => (
    <div className="p-6">
      <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Export Options</button>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center"><Archive className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Complete Business Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This will export all your business data into a single ZIP file.</p>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Included Data</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'customers', label: 'Customers', icon: '👥', count: counts.customers },
                    { key: 'suppliers', label: 'Suppliers', icon: '🏢', count: counts.suppliers },
                    { key: 'products', label: 'Products', icon: '📦', count: counts.products },
                    { key: 'sales', label: 'Sales', icon: '🧾', count: counts.sales },
                    { key: 'purchases', label: 'Purchases', icon: '📋', count: counts.purchases },
                    { key: 'expenses', label: 'Expenses', icon: '💰', count: counts.expenses },
                    { key: 'stockMovements', label: 'Stock', icon: '📊', count: counts.stockMovements },
                    { key: 'payments', label: 'Payments', icon: '💳', count: counts.payments },
                    { key: 'gstRecords', label: 'GST Data', icon: '📑', count: counts.gstRecords },
                  ].map(item => (
                    <div key={item.key} className="bg-white dark:bg-gray-700 rounded-lg p-3 flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div><p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p><p className="text-xs text-slate-400">{(item.count || 0).toLocaleString()} records</p></div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 dark:border-gray-600 pt-3 mt-3 text-center">
                  <p className="text-xs text-slate-400">Backup format: ZIP containing JSON files + metadata</p>
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-soft"><Play className="w-4 h-4" /> Create Backup</button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="p-6 space-y-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center"><Archive className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Creating Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while your backup is created.</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{importTask || 'Collecting data...'}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importProgress}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${importProgress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full" />
                </div>
                <div className="flex justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-6 max-w-lg mx-auto">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult?.failed ? 'bg-amber-100' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
                  {importResult?.failed ? <AlertCircle className="w-8 h-8 text-amber-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{importResult?.failed ? 'Backup Failed' : 'Backup Created Successfully'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{importResult?.fileName && `File: ${importResult.fileName}`}</p>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => setActiveView('menu')} className="px-5 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg">Done</button>
                <button onClick={() => { setStep(0); setImportResult(null); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"><Archive className="w-4 h-4" /> Create Another</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const renderReportWizard = () => (
    <div className="p-6">
      <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Export Options</button>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center"><BarChart3 className="w-7 h-7 text-amber-600 dark:text-amber-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Select Report Type</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose the report you want to export.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {REPORT_TYPES.map(rt => (
                  <button key={rt} onClick={() => setReportType(rt)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${reportType === rt ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-amber-200'}`}>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{rt}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setActiveView('menu')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">Format <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center"><FileText className="w-7 h-7 text-amber-600 dark:text-amber-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Format & Filters</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose format and set date range.</p>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Export Format</label>
                <div className="flex gap-3">
                  {[
                    { value: 'pdf', label: 'PDF', icon: FileText },
                    { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
                    { value: 'csv', label: 'CSV', icon: Table2 },
                  ].map(f => (
                    <button key={f.value} onClick={() => setReportFormat(f.value)} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${reportFormat === f.value ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-amber-200'}`}>
                      <f.icon className={`w-6 h-6 ${reportFormat === f.value ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-medium ${reportFormat === f.value ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}`}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From Date</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To Date</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm" /></div>
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleReportExport} disabled={importing} className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 shadow-soft">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {importing ? 'Exporting...' : 'Export Report'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center"><BarChart3 className="w-7 h-7 text-amber-600 dark:text-amber-400" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Exporting Report</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while your report is generated.</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{importTask}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importProgress}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${importProgress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full" />
                </div>
                <div className="flex justify-center"><Loader2 className="w-8 h-8 text-amber-600 animate-spin" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 space-y-6 max-w-lg mx-auto">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult?.failed ? 'bg-amber-100' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
                  {importResult?.failed ? <AlertCircle className="w-8 h-8 text-amber-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{importResult?.failed ? 'Export Failed' : 'Report Exported Successfully'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{importResult?.fileName && `File: ${importResult.fileName}`}</p>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => setActiveView('menu')} className="px-5 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg">Done</button>
                <button onClick={() => { setStep(0); setImportResult(null); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"><BarChart3 className="w-4 h-4" /> Export Another</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          {activeView === 'menu' && renderMenu()}
          {activeView === 'excel' && renderExcelWizard()}
          {activeView === 'backup' && renderBackupWizard()}
          {activeView === 'report' && renderReportWizard()}
        </div>
      </div>
    </div>
  );
};

export default ExportData;
