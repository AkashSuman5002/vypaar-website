import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Database, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, File, Loader2, ChevronRight, Server, Settings2, Play, BarChart3, HardDrive, X, FileArchive } from 'lucide-react';
import { toast } from 'react-toastify';
import { importAPI } from '../../services/api';

const STEPS = ['Upload Backup', 'Analysis', 'Select Data', 'Options', 'Import', 'Completed'];

const ACCEPTED_TYPES = ['.backup', '.zip', '.db', '.sqlite', '.sqlite3'];
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const dataTypeIcons = {
  customers: '👥', suppliers: '🏢', products: '📦', sales: '🧾',
  purchases: '📋', expenses: '💰', stockMovements: '📊', payments: '💳', gstRecords: '📑',
};

const VyaparBackupImportWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [historyId, setHistoryId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedTables, setSelectedTables] = useState(['customers', 'products', 'sales', 'purchases', 'expenses', 'stockMovements', 'payments', 'gstRecords']);
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTask, setImportTask] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    const ext = '.' + droppedFile.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      toast.error(`Unsupported format: ${ext}. Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }
    if (droppedFile.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 500MB limit');
      return;
    }
    setFile(droppedFile);
  }, []);

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 500MB limit');
      return;
    }
    setFile(selected);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file'); return; }
    setImporting(true);
    setImportTask('Uploading backup file...');
    try {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await importAPI.backupUpload(formData);
      setHistoryId(res.data.historyId);
      toast.success('Backup uploaded successfully');
      setImporting(false);
      setStep(1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
      setImporting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!historyId) return;
    setImporting(true);
    setImportTask('Analyzing backup file...');
    try {
      const res = await importAPI.backupAnalyze(historyId);
      setAnalysis(res.data);
      setStep(2);
      toast.success('Analysis complete');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Analysis failed');
    } finally {
      setImporting(false);
    }
  };

  const toggleTable = (key) => {
    setSelectedTables(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  const handleImport = async () => {
    if (!historyId) return;
    if (selectedTables.length === 0) { toast.error('Select at least one data type'); return; }
    setImporting(true);
    setStep(4);
    setImportProgress(0);

    try {
      setImportProgress(10);
      setImportTask('Starting import...');
      await new Promise(r => setTimeout(r, 300));

      setImportProgress(25);
      setImportTask('Importing customers & suppliers...');
      await new Promise(r => setTimeout(r, 300));

      setImportProgress(40);
      setImportTask('Importing products...');

      setImportProgress(55);
      setImportTask('Importing sales & purchases...');

      setImportProgress(70);
      setImportTask('Importing expenses & stock...');

      setImportProgress(85);
      setImportTask('Importing GST records & payments...');

      const res = await importAPI.backupExecute({
        historyId,
        selectedTables,
        duplicateHandling,
      });

      setImportProgress(100);
      setImportTask('Completed!');
      setImportResult(res.data);
      setStep(5);
      toast.success('Import completed!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Import failed');
      setImportResult({ failed: true, errors: [e.message], results: {} });
      setStep(5);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setHistoryId(null);
    setAnalysis(null);
    setSelectedTables(['customers', 'products', 'sales', 'purchases', 'expenses', 'stockMovements', 'payments', 'gstRecords']);
    setImportResult(null);
  };

  const stepper = (idx) => (
    <div className="flex items-center">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${step > idx ? 'bg-emerald-600 border-emerald-600 text-white' : step === idx ? 'border-emerald-600 text-emerald-600' : 'border-slate-300 dark:border-gray-600 text-slate-400 dark:text-slate-500'}`}>
        {step > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
      </div>
      <span className={`ml-2 text-xs font-medium hidden sm:inline ${step >= idx ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{STEPS[idx]}</span>
      {idx < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${step > idx ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-gray-700'}`} />}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
      {/* Stepper */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {STEPS.map((_, i) => stepper(i))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                  <HardDrive className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upload Vyapar Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload a Vyapar backup file (.backup, .zip, .db, .sqlite)</p>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' : file ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                onClick={() => document.getElementById('backup-file-input')?.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <FileArchive className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors">
                      <X className="w-3 h-3 inline mr-1" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Drop backup file here</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Accepted: {ACCEPTED_TYPES.join(', ')} (max 500MB)</p>
                  </div>
                )}
                <input id="backup-file-input" type="file" accept={ACCEPTED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
              </div>
              <div className="flex justify-end mt-6">
                <button disabled={!file || importing} onClick={handleUpload} className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-soft">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Uploading...' : 'Upload & Analyze'}
                </button>
              </div>
            </div>
          )}

          {step === 1 && analysis && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <Database className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Backup Analysis</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Detected the following data in your backup.</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center text-sm text-slate-500 dark:text-slate-400">
                <span className="px-3 py-1 bg-slate-100 dark:bg-gray-700 rounded-lg">Version: {analysis.version}</span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-gray-700 rounded-lg">Size: {(analysis.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                {analysis.backupDate && <span className="px-3 py-1 bg-slate-100 dark:bg-gray-700 rounded-lg">Date: {new Date(analysis.backupDate).toLocaleDateString()}</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Object.entries(analysis.detected || {}).filter(([, count]) => count > 0).map(([key, count]) => (
                  <div key={key} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                    <span className="text-2xl block mb-1">{dataTypeIcons[key] || '📁'}</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{count.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={() => { setStep(0); setAnalysis(null); }} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleAnalyze} disabled={importing} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && analysis && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Select Data to Import</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose which data types to include in the import.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries({
                  customers: 'Customers & Parties', suppliers: 'Suppliers', products: 'Products & Items',
                  sales: 'Sales Invoices', purchases: 'Purchase Bills', expenses: 'Expenses',
                  stockMovements: 'Stock Movements', payments: 'Payments', gstRecords: 'GST Records',
                }).map(([key, label]) => {
                  const count = analysis.detected?.[key] || 0;
                  const selected = selectedTables.includes(key);
                  return (
                    <button key={key} type="button" onClick={() => toggleTable(key)} disabled={count === 0}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-indigo-200'} ${count === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-gray-600'}`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{count.toLocaleString()} records</p>
                      </div>
                      <span className="text-xl">{dataTypeIcons[key] || '📁'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                  Options <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Settings2 className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Import Options</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure how duplicates are handled.</p>
              </div>
              <div className="max-w-lg mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Duplicate Handling</label>
                  <div className="space-y-3">
                    {[
                      { value: 'skip', label: 'Skip Existing Records', desc: 'Records matching existing names or invoice numbers will be skipped.' },
                      { value: 'update', label: 'Update Existing Records', desc: 'Existing records will be overwritten with imported data.' },
                      { value: 'create', label: 'Create Duplicate Records', desc: 'All records will be inserted, even if duplicates exist.' },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${duplicateHandling === opt.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-indigo-200'}`}>
                        <input type="radio" name="dup" value={opt.value} checked={duplicateHandling === opt.value} onChange={(e) => setDuplicateHandling(e.target.value)} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{opt.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Importing large backups may take several minutes. The process runs on the server and will process all selected data types sequentially.</span>
                  </p>
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleImport} disabled={importing} className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-soft disabled:opacity-50">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start Import
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="p-6 space-y-8">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                  <Server className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Importing Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while your Vyapar data is being imported.</p>
              </div>
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{importTask}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{importProgress}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${importProgress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full" />
                  </div>
                </div>
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult?.failed ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
                  {importResult?.failed ? <AlertCircle className="w-8 h-8 text-amber-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{importResult?.failed ? 'Import Completed with Errors' : 'Import Completed Successfully'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your Vyapar data has been imported.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                {importResult?.results && Object.entries(importResult.results).filter(([, v]) => v > 0).map(([key, count]) => (
                  <div key={key} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                    <span className="text-lg block mb-1">{dataTypeIcons[key] || '📁'}</span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{count}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  </div>
                ))}
              </div>
              {importResult?.failed > 0 && (
                <div className="text-center text-sm text-amber-600 dark:text-amber-400">Failed Records: {importResult.failed}</div>
              )}
              {importResult?.errors?.length > 0 && (
                <div className="max-w-lg mx-auto bg-red-50 dark:bg-red-500/10 rounded-xl p-4 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">{e}</p>)}
                  {importResult.errors.length > 10 && <p className="text-xs text-red-400">...and {importResult.errors.length - 10} more errors</p>}
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button onClick={onComplete} className="px-5 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">Done</button>
                <button onClick={reset} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"><Upload className="w-4 h-4" /> Import Another</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default VyaparBackupImportWizard;
