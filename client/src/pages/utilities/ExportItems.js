import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Download, Users, Package, ShoppingCart, Receipt, Archive, FileSpreadsheet } from 'lucide-react';
import { exportAPI } from '../../services/api';

const MODULES = [
  { key: 'Parties', label: 'Parties', icon: Users, default: true },
  { key: 'Items', label: 'Items', icon: Package, default: true },
  { key: 'Sales', label: 'Sales', icon: ShoppingCart, default: true },
  { key: 'Purchases', label: 'Purchases', icon: Receipt, default: true },
  { key: 'Expenses', label: 'Expenses', icon: FileSpreadsheet, default: false },
  { key: 'Stock', label: 'Stock', icon: Archive, default: false },
];

const ExportItems = () => {
  const [selectedModules, setSelectedModules] = useState(MODULES.filter(m => m.default).map(m => m.key));
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counts, setCounts] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    exportAPI.getCounts().then(r => setCounts(r.data)).catch(() => {});
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await exportAPI.getHistory({ limit: 5 });
      setHistory(res.data.histories || []);
    } catch {}
  };

  const toggleModule = (key) => setSelectedModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleExport = async () => {
    if (selectedModules.length === 0) { toast.error('Select at least one module'); return; }
    setExporting(true);
    try {
      const res = await exportAPI.excelExport({ modules: selectedModules, format: 'xlsx', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
      const disposition = res.headers['content-disposition'];
      const match = disposition && disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const fileName = match ? match[1].replace(/['"]/g, '') : `export_${new Date().toISOString().split('T')[0]}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = fileName;
      a.click(); window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully!');
      loadHistory();
    } catch (err) { toast.error(err.response?.data?.message || 'Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Export Items</h1>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Select Data to Export</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isSelected = selectedModules.includes(mod.key);
            return (
              <label key={mod.key} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleModule(mod.key)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <span className="text-sm font-medium text-slate-700">{mod.label}</span>
                  {counts[mod.key] !== undefined && <span className="text-xs text-slate-400 ml-1">({counts[mod.key]})</span>}
                </div>
              </label>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">From Date</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">To Date</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" /></div>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-400">{selectedModules.length} module(s) selected</p>
          <button onClick={handleExport} disabled={exporting || selectedModules.length === 0} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200"><h3 className="text-base font-bold text-slate-900">Recent Exports</h3></div>
          <div className="divide-y divide-slate-100">
            {history.map((h, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50">
                <div><p className="text-sm font-medium text-slate-900">{h.fileName || h.filename || 'Export'}</p><p className="text-xs text-slate-400">{new Date(h.createdAt || h.date).toLocaleString('en-IN')}</p></div>
                <a href={`http://localhost:5000/api/export/history/${h._id}/download`} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> Download</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ExportItems;
