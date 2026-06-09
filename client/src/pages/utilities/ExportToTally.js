import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Download, ArrowRight } from 'lucide-react';
import { exportAPI } from '../../services/api';

const ExportToTally = () => {
  const [exportType, setExportType] = useState('xml');
  const [selectedModules, setSelectedModules] = useState(['ledgers', 'vouchers']);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const modules = [
    { id: 'ledgers', label: 'Ledgers (Parties)', description: 'Export all party ledger data' },
    { id: 'vouchers', label: 'Vouchers (Transactions)', description: 'Export sales, purchase, payment, and receipt vouchers' },
    { id: 'stock', label: 'Stock Items', description: 'Export inventory/stock item data with quantities and rates' },
    { id: 'groups', label: 'Account Groups', description: 'Export chart of accounts and group hierarchy' },
  ];

  const toggleModule = (id) => setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleExport = async () => {
    if (selectedModules.length === 0) { toast.error('Select at least one module'); return; }
    setExporting(true);
    try {
      const res = await exportAPI.excelExport({ modules: selectedModules, format: exportType, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `tally_export_${new Date().toISOString().split('T')[0]}.${exportType === 'xml' ? 'xml' : 'xlsx'}`;
      a.click(); window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully!');
    } catch (err) { toast.error(err.response?.data?.message || 'Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Export To Tally</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">Select Export Format</h2>
          <div className="flex gap-4 mb-6">
            {['xml', 'xlsx'].map(fmt => (
              <label key={fmt} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all flex-1 ${exportType === fmt ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="format" checked={exportType === fmt} onChange={() => setExportType(fmt)} className="w-4 h-4 text-blue-600" />
                <div><p className="text-sm font-semibold text-slate-900">{fmt === 'xml' ? 'XML Format' : 'Excel Format'}</p><p className="text-xs text-slate-500">{fmt === 'xml' ? 'Direct Tally import format' : 'For manual review before import'}</p></div>
              </label>
            ))}
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-3">Select Data to Export</h3>
          <div className="space-y-3 mb-6">
            {modules.map(mod => (
              <label key={mod.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedModules.includes(mod.id) ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={selectedModules.includes(mod.id)} onChange={() => toggleModule(mod.id)} className="w-4 h-4 text-blue-600 rounded border-slate-300 mt-0.5" />
                <div><p className="text-sm font-semibold text-slate-900">{mod.label}</p><p className="text-xs text-slate-500 mt-0.5">{mod.description}</p></div>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">From Date</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">To Date</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" /></div>
          </div>
          <button onClick={handleExport} disabled={exporting || selectedModules.length === 0} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Export Instructions</h3>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span><span>Select the data modules you want to export.</span></li>
            <li className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span><span>Choose a date range (optional) to filter data.</span></li>
            <li className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span><span>Click Export to download the file.</span></li>
            <li className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span><span>Import into Tally: Gateway of Tally &gt; Import.</span></li>
          </ol>
        </div>
      </div>
    </motion.div>
  );
};

export default ExportToTally;
