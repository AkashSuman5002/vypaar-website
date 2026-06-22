import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { History, Download, Trash2, RefreshCw, FileSpreadsheet, Database, AlertCircle, CheckCircle2, Clock, Eye, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { importAPI } from '../services/api';

const ImportHistoryPage = () => {
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewDetail, setViewDetail] = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await importAPI.getHistory({ page: p, limit: 20 });
      setHistories(data.histories);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch { toast.error('Failed to load history'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this import history?')) return;
    try {
      await importAPI.deleteHistory(id);
      toast.success('Deleted');
      load(page);
    } catch { toast.error('Delete failed'); }
  };

  const handleDownloadLog = async (id) => {
    try {
      const res = await importAPI.getHistoryLog(id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `import-${id}.log`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const typeIcon = (t) => t === 'excel' ? <FileSpreadsheet className="w-5 h-5 text-blue-500" /> : <Database className="w-5 h-5 text-emerald-500" />;
  const statusBadge = (s) => {
    if (s === 'completed') return <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
    if (s === 'partial') return <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5" /> Partial</span>;
    if (s === 'failed') return <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="w-3.5 h-3.5" /> Failed</span>;
    return <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"><Clock className="w-3.5 h-3.5" /> In Progress</span>;
  };

  if (viewDetail) {
    const h = viewDetail;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => setViewDetail(null)} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to History
        </button>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {typeIcon(h.importType)}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">{h.importType.replace('_', ' ')} Import</h3>
                <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {statusBadge(h.status)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {Object.entries(h.summary || {}).filter(([, v]) => v > 0).map(([key, count]) => (
              <div key={key} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
            ))}
          </div>
          {h.errorLog?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Errors ({h.errorLog.length})</h4>
              <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 max-h-48 overflow-y-auto space-y-1">
                {h.errorLog.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>)}
              </div>
            </div>
          )}
          <div className="flex gap-3 text-xs text-slate-400">
            {h.fileName && <span>File: {h.fileName}</span>}
            {h.fileSize > 0 && <span>Size: {(h.fileSize / (1024 * 1024)).toFixed(2)} MB</span>}
            {h.vyaparVersion && <span>Version: {h.vyaparVersion}</span>}
            {h.duplicateHandling && <span>Duplicates: {h.duplicateHandling}</span>}
            {h.completedAt && <span>Completed: {new Date(h.completedAt).toLocaleString()}</span>}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import History</h1>
        <button onClick={() => load(page)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : histories.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft">
          <History className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Import History</h3>
          <p className="text-sm text-slate-400">Import data to see your history here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {histories.map((h) => (
            <div key={h._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {typeIcon(h.importType)}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{h.importType.replace('_', ' ')} Import</p>
                    <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(h.status)}
                  <button onClick={() => setViewDetail(h)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDownloadLog(h._id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(h._id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {h.summary && Object.values(h.summary).some(v => v > 0) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(h.summary).filter(([, v]) => v > 0).map(([key, count]) => (
                    <span key={key} className="px-2.5 py-1 bg-slate-50 dark:bg-gray-700/30 text-xs text-slate-600 dark:text-slate-400 rounded-lg capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: {count}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => load(p)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}>{p}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ImportHistoryPage;
