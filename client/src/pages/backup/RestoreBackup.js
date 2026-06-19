import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileArchive, Loader2, AlertTriangle, CheckCircle2, AlertCircle, ArrowLeft, RotateCcw, Database } from 'lucide-react';
import { toast } from 'react-toastify';
import { backupAPI } from '../../services/api';

const RESTORE_MODES = [
  { value: 'merge', label: 'Merge', desc: 'Add backup data on top of existing records.' },
  { value: 'overwrite', label: 'Overwrite', desc: 'Replace current data with the backup contents.' },
];

const RestoreBackup = () => {
  const [step, setStep] = useState(0); // 0 select, 1 preview, 2 result
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('merge');
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(0);
    setFile(null);
    setPreview(null);
    setResult(null);
    setMode('merge');
  };

  const analyzeFile = useCallback(async (selected) => {
    if (!selected) return;
    const name = (selected.name || '').toLowerCase();
    if (!name.endsWith('.json') && !name.endsWith('.zip')) {
      toast.error('Please select a .json or .zip backup file');
      return;
    }
    setFile(selected);
    setAnalyzing(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res = await backupAPI.restorePreview(formData);
      const data = res?.data ?? res;
      setPreview(data);
      setStep(1);
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to analyze backup file';
      toast.error(msg);
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFileInput = (e) => {
    const selected = e.target.files?.[0];
    if (selected) analyzeFile(selected);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) analyzeFile(dropped);
  };

  const handleRestore = async () => {
    if (!preview) return;
    const confirmed = window.confirm(
      mode === 'overwrite'
        ? 'WARNING: Overwrite mode will REPLACE your current business data with the backup. This cannot be undone. Continue?'
        : 'This will merge the backup data into your current business data. Continue?'
    );
    if (!confirmed) return;
    setRestoring(true);
    try {
      const res = await backupAPI.restoreExecute({ ...preview, mode });
      const data = res?.data ?? res;
      setResult({ success: true, message: data?.message, results: data?.results });
      setStep(2);
      toast.success(data?.message || 'Restore completed');
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Restore failed';
      setResult({ success: false, message: msg });
      setStep(2);
      toast.error(msg);
    } finally {
      setRestoring(false);
    }
  };

  const counts = preview?.counts || {};
  const countEntries = Object.entries(counts);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <RotateCcw className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Restore Backup</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Restore your business data from a backup file.</p>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP 0 — Select file */}
              {step === 0 && (
                <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="max-w-xl mx-auto space-y-5">
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${dragging ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-300 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-700'}`}
                  >
                    <input type="file" accept=".json,.zip" onChange={handleFileInput} className="hidden" disabled={analyzing} />
                    {analyzing ? (
                      <>
                        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Analyzing backup...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                          <UploadCloud className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop a backup file here, or click to browse</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Supported formats: .json, .zip</p>
                      </>
                    )}
                  </label>

                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">Restoring a backup will overwrite or merge your current business data. Make sure you have a recent backup before proceeding.</p>
                  </div>
                </motion.div>
              )}

              {/* STEP 1 — Preview */}
              {step === 1 && (
                <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="max-w-xl mx-auto space-y-5">
                  <button onClick={reset} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    <ArrowLeft className="w-4 h-4" /> Choose a different file
                  </button>

                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                    <FileArchive className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file?.name}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Backup Contents</h3>
                    {countEntries.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">No records detected in this backup.</div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Collection</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Records</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                            {countEntries.map(([key, val]) => (
                              <tr key={key} className="hover:bg-slate-50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 capitalize">{key}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100">{Number(val || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Mode */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Restore Mode</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {RESTORE_MODES.map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMode(m.value)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${mode === m.value ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-700'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.label}</span>
                            {mode === m.value && <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{m.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {mode === 'overwrite'
                        ? 'Overwrite mode replaces your current business data with the backup. This action cannot be undone.'
                        : 'Merge mode adds backup data to your current business data. Duplicate records may be created.'}
                    </p>
                  </div>

                  <div className="flex justify-between pt-1">
                    <button onClick={reset} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 shadow-soft"
                    >
                      {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {restoring ? 'Restoring...' : 'Restore Now'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2 — Result */}
              {step === 2 && (
                <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="max-w-xl mx-auto space-y-6">
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result?.success ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                      {result?.success ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <AlertCircle className="w-8 h-8 text-red-500" />}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{result?.success ? 'Restore Completed' : 'Restore Failed'}</h3>
                    {result?.message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{result.message}</p>}
                  </div>

                  {result?.success && result?.results && (
                    <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Results</p>
                      <div className="space-y-1.5">
                        {Object.entries(result.results).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400 capitalize">{key}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center gap-3">
                    <button onClick={reset} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
                      <RotateCcw className="w-4 h-4" /> Restore Another
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestoreBackup;
