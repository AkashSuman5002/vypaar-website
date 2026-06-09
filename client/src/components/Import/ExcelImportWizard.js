import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, X, File, Loader2, ChevronRight, Download, RefreshCw, Table2, Settings2, Play, BarChart3 } from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { importAPI } from '../../services/api';

const STEPS = ['Upload Files', 'Validation', 'Column Mapping', 'Preview Data', 'Import Settings', 'Import Process', 'Completed'];

const ACCEPTED_TYPES = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const REQUIRED_TYPES = ['Parties', 'Items', 'Sales', 'Purchases', 'Expenses', 'Stock'];

const typeIcons = {
  Parties: '👥', Items: '📦', Sales: '🧾', Purchases: '📋', Expenses: '💰', Stock: '📊',
};

const defaultMappings = {
  Parties: [
    { vyapar: 'Party Name', field: 'name', type: 'text' },
    { vyapar: 'Mobile Number', field: 'phone', type: 'text' },
    { vyapar: 'GST Number', field: 'gstNumber', type: 'text' },
    { vyapar: 'Address', field: 'address', type: 'text' },
    { vyapar: 'Email', field: 'email', type: 'text' },
    { vyapar: 'Opening Balance', field: 'openingBalance', type: 'number' },
    { vyapar: 'Credit Limit', field: 'creditLimit', type: 'number' },
  ],
  Items: [
    { vyapar: 'Item Name', field: 'name', type: 'text' },
    { vyapar: 'Category', field: 'category', type: 'text' },
    { vyapar: 'Price', field: 'price', type: 'number' },
    { vyapar: 'Stock', field: 'stock', type: 'number' },
    { vyapar: 'GST Rate', field: 'gstRate', type: 'number' },
    { vyapar: 'Unit', field: 'unit', type: 'text' },
    { vyapar: 'HSN', field: 'hsn', type: 'text' },
    { vyapar: 'Cost Price', field: 'costPrice', type: 'number' },
  ],
  Sales: [
    { vyapar: 'Invoice No', field: 'invoiceNumber', type: 'text' },
    { vyapar: 'Customer', field: 'customerName', type: 'text' },
    { vyapar: 'Date', field: 'date', type: 'date' },
    { vyapar: 'Total', field: 'totalAmount', type: 'number' },
    { vyapar: 'Paid', field: 'paidAmount', type: 'number' },
    { vyapar: 'Payment Method', field: 'paymentMethod', type: 'text' },
    { vyapar: 'Taxable', field: 'taxableAmount', type: 'number' },
    { vyapar: 'CGST', field: 'cgstTotal', type: 'number' },
    { vyapar: 'SGST', field: 'sgstTotal', type: 'number' },
  ],
  Purchases: [
    { vyapar: 'Invoice No', field: 'invoiceNumber', type: 'text' },
    { vyapar: 'Supplier', field: 'supplierName', type: 'text' },
    { vyapar: 'Date', field: 'date', type: 'date' },
    { vyapar: 'Total', field: 'totalAmount', type: 'number' },
    { vyapar: 'Paid', field: 'paidAmount', type: 'number' },
    { vyapar: 'Payment Method', field: 'paymentMethod', type: 'text' },
  ],
  Expenses: [
    { vyapar: 'Date', field: 'date', type: 'date' },
    { vyapar: 'Category', field: 'category', type: 'text' },
    { vyapar: 'Amount', field: 'amount', type: 'number' },
    { vyapar: 'Description', field: 'description', type: 'text' },
    { vyapar: 'Payment Method', field: 'paymentMethod', type: 'text' },
  ],
  Stock: [
    { vyapar: 'Item Name', field: 'productName', type: 'text' },
    { vyapar: 'Quantity', field: 'quantity', type: 'number' },
    { vyapar: 'Type', field: 'type', type: 'text' },
    { vyapar: 'Date', field: 'date', type: 'date' },
    { vyapar: 'Reference', field: 'reference', type: 'text' },
  ],
};

const appFields = {
  Parties: ['name', 'phone', 'gstNumber', 'address', 'email', 'openingBalance', 'creditLimit'],
  Items: ['name', 'category', 'price', 'stock', 'gstRate', 'unit', 'hsn', 'costPrice'],
  Sales: ['invoiceNumber', 'customerName', 'date', 'totalAmount', 'paidAmount', 'paymentMethod', 'taxableAmount', 'cgstTotal', 'sgstTotal'],
  Purchases: ['invoiceNumber', 'supplierName', 'date', 'totalAmount', 'paidAmount', 'paymentMethod'],
  Expenses: ['date', 'category', 'amount', 'description', 'paymentMethod'],
  Stock: ['productName', 'quantity', 'type', 'date', 'reference'],
};

const ExcelImportWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [parsedData, setParsedData] = useState({});
  const [validationResults, setValidationResults] = useState({});
  const [columnMappings, setColumnMappings] = useState({});
  const [previewData, setPreviewData] = useState({});
  const [summary, setSummary] = useState({});
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [financialYear, setFinancialYear] = useState('all');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTask, setImportTask] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [dragging, setDragging] = useState(null);
  const fileInputRefs = {};

  const handleDrop = useCallback((type, e) => {
    e.preventDefault();
    setDragging(null);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => ACCEPTED_TYPES.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (droppedFiles.length === 0) { toast.error('Please drop .xlsx, .xls, or .csv files'); return; }
    handleFiles(type, droppedFiles);
  }, []);

  const handleFileSelect = (type, e) => {
    const selected = Array.from(e.target.files);
    handleFiles(type, selected);
    e.target.value = '';
  };

  const handleFiles = (type, newFiles) => {
    const valid = newFiles.filter(f => {
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} exceeds 500MB`); return false; }
      return true;
    });
    if (valid.length === 0) return;
    setFiles(prev => [...prev.filter(f => f.type !== type), ...valid.map(f => ({ file: f, type, name: f.name, size: f.size, status: 'pending' }))]);
    valid.forEach(f => parseFile(type, f));
  };

  const parseFile = async (type, file) => {
    try {
      setFiles(prev => prev.map(f => f.file === file ? { ...f, status: 'reading' } : f));
      const data = await readFileAsArrayBuffer(file);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      setParsedData(prev => ({ ...prev, [type]: json }));
      setFiles(prev => prev.map(f => f.file === file ? { ...f, status: 'parsed', rows: json.length } : f));
      validateColumns(type, json);
    } catch (e) {
      toast.error(`Failed to parse ${file.name}: ${e.message}`);
      setFiles(prev => prev.map(f => f.file === file ? { ...f, status: 'error' } : f));
    }
  };

  const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });

  const validateColumns = (type, data) => {
    if (!data || data.length === 0) return;
    const columns = Object.keys(data[0]);
    const expectedColumns = defaultMappings[type]?.map(m => m.vyapar) || [];
    const issues = [];
    const matched = [];
    for (const expected of expectedColumns) {
      const found = columns.find(c => c.toLowerCase().trim() === expected.toLowerCase().trim());
      if (found) {
        matched.push(found);
      } else {
        issues.push({ severity: 'warning', message: `${expected} column not found` });
      }
    }
    const extraCols = columns.filter(c => !expectedColumns.some(e => e.toLowerCase().trim() === c.toLowerCase().trim()));
    setValidationResults(prev => ({ ...prev, [type]: { columns, matched, issues, extraCols, totalRows: data.length, valid: issues.length === 0 } }));
    autoMapColumns(type, columns);
  };

  const autoMapColumns = (type, columns) => {
    const mapping = {};
    const defs = defaultMappings[type] || [];
    for (const def of defs) {
      const match = columns.find(c => c.toLowerCase().trim() === def.vyapar.toLowerCase().trim());
      mapping[def.vyapar] = match ? def.field : '';
    }
    setColumnMappings(prev => ({ ...prev, [type]: mapping }));
  };

  const updateMapping = (type, vyaparCol, field) => {
    setColumnMappings(prev => ({ ...prev, [type]: { ...prev[type], [vyaparCol]: field } }));
  };

  const generatePreview = () => {
    const sum = {};
    const prev = {};
    for (const type of REQUIRED_TYPES) {
      const data = parsedData[type] || [];
      sum[type] = data.length;
      const mapping = columnMappings[type] || {};
      const mapped = data.slice(0, 10).map(row => {
        const obj = {};
        for (const [vyaparCol, appField] of Object.entries(mapping)) {
          if (appField) obj[appField] = row[vyaparCol];
        }
        return obj;
      });
      prev[type] = mapped;
    }
    setSummary(sum);
    setPreviewData(prev);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    setStep(5);
    setImportProgress(0);

    try {
      const filesPayload = REQUIRED_TYPES.filter(t => parsedData[t] && parsedData[t].length > 0).map(t => ({ type: t, data: parsedData[t], columns: Object.keys(parsedData[t][0] || {}) }));

      setImportProgress(10);
      setImportTask('Uploading data...');
      await new Promise(r => setTimeout(r, 500));

      setImportProgress(25);
      setImportTask('Validating records...');
      await new Promise(r => setTimeout(r, 500));

      setImportProgress(40);
      setImportTask('Importing customers & suppliers...');

      setImportProgress(55);
      setImportTask('Importing products...');

      setImportProgress(70);
      setImportTask('Importing sales & purchases...');

      setImportProgress(85);
      setImportTask('Importing expenses & stock...');

      const res = await importAPI.excelExecute({
        files: filesPayload,
        columnMapping: columnMappings,
        duplicateHandling,
        financialYear,
      });

      setImportProgress(100);
      setImportTask('Completed!');
      setImportResult(res.data);
      setStep(6);
      toast.success('Import completed!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Import failed');
      setImportResult({ failed: true, errors: [e.message], results: {} });
      setStep(6);
    } finally {
      setImporting(false);
    }
  };

  const removeFile = (type) => {
    setFiles(prev => prev.filter(f => f.type !== type));
    setParsedData(prev => { const n = { ...prev }; delete n[type]; return n; });
    setValidationResults(prev => { const n = { ...prev }; delete n[type]; return n; });
    setColumnMappings(prev => { const n = { ...prev }; delete n[type]; return n; });
  };

  const allFilesParsed = REQUIRED_TYPES.every(t => {
    const file = files.find(f => f.type === t);
    return file && file.status === 'parsed';
  }) || Object.keys(parsedData).length > 0;

  const allValid = REQUIRED_TYPES.filter(t => parsedData[t]).every(t => validationResults[t]?.valid !== false);

  const stepper = (idx) => (
    <div className="flex items-center">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${step > idx ? 'bg-blue-600 border-blue-600 text-white' : step === idx ? 'border-blue-600 text-blue-600' : 'border-slate-300 dark:border-gray-600 text-slate-400 dark:text-slate-500'}`}>
        {step > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
      </div>
      <span className={`ml-2 text-xs font-medium hidden sm:inline ${step >= idx ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{STEPS[idx]}</span>
      {idx < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${step > idx ? 'bg-blue-600' : 'bg-slate-200 dark:bg-gray-700'}`} />}
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
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upload Excel Files</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Drag and drop or select files exported from Vyapar.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REQUIRED_TYPES.map(type => {
                  const file = files.find(f => f.type === type);
                  const hasData = parsedData[type] && parsedData[type].length > 0;
                  return (
                    <div key={type}
                      onDragOver={(e) => { e.preventDefault(); setDragging(type); }}
                      onDragLeave={() => setDragging(null)}
                      onDrop={(e) => handleDrop(type, e)}
                      className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all ${dragging === type ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10' : hasData ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'}`}
                    >
                      {hasData && <div className="absolute top-2 right-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>}
                      <div className="text-3xl mb-2">{typeIcons[type]}</div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{type}.xlsx</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Drop file here'}
                      </p>
                      {file && file.status === 'parsed' && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{file.rows || 0} records</p>}
                      {file && file.status === 'error' && <p className="text-xs text-red-500 mt-1">Parse error</p>}
                      <input ref={el => fileInputRefs[type] = el} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileSelect(type, e)} className="hidden" />
                      <div className="mt-3 flex gap-2 justify-center">
                        <button type="button" onClick={() => fileInputRefs[type]?.click()} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          {hasData ? 'Replace' : 'Select'}
                        </button>
                        {hasData && <button type="button" onClick={() => removeFile(type)} className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors">Remove</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">Accepted: .xlsx, .xls, .csv (max 500MB each)</p>
                <button disabled={!allFilesParsed} onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  Validate <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Validation</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Validating file structure and required columns.</p>
              </div>
              <div className="space-y-4">
                {REQUIRED_TYPES.filter(t => parsedData[t]).map(type => {
                  const vr = validationResults[type];
                  if (!vr) return null;
                  return (
                    <div key={type} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{typeIcons[type]}</span>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">{type}</h4>
                          <span className="text-xs text-slate-400 dark:text-slate-500">({vr.totalRows} records)</span>
                        </div>
                        {vr.valid ? <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Valid</span> : <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><AlertCircle className="w-3.5 h-3.5" /> Needs attention</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {vr.matched.map(col => <span key={col} className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{col}</span>)}
                      </div>
                      {vr.issues.length > 0 && <div className="mt-2 space-y-1">
                        {vr.issues.map((issue, i) => <div key={i} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5" />{issue.message}</div>)}
                      </div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Column Mapping <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Column Mapping</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Map Vyapar columns to application fields.</p>
              </div>
              <div className="space-y-6">
                {REQUIRED_TYPES.filter(t => parsedData[t]).map(type => {
                  const mapping = columnMappings[type] || {};
                  const defs = defaultMappings[type] || [];
                  const columns = validationResults[type]?.columns || [];
                  return (
                    <div key={type} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2"><span className="text-lg">{typeIcons[type]}</span>{type}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-gray-600">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Vyapar Column</th>
                              <th className="px-3 py-2 text-center text-xs text-slate-400 w-8"></th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">App Field</th>
                            </tr>
                          </thead>
                          <tbody>
                            {defs.map((def) => (
                              <tr key={def.vyapar} className="border-b border-slate-100 dark:border-gray-700/50">
                                <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{def.vyapar}</td>
                                <td className="px-3 py-2 text-center text-slate-400"><ChevronRight className="w-4 h-4" /></td>
                                <td className="px-3 py-2">
                                  <select value={mapping[def.vyapar] || ''} onChange={(e) => updateMapping(type, def.vyapar, e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="">-- Skip --</option>
                                    {appFields[type]?.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={generatePreview} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Preview <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Preview Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review a sample of the data to be imported.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {Object.entries(summary).map(([type, count]) => (
                  <div key={type} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                    <span className="text-xl block mb-1">{typeIcons[type]}</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{count.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{type}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {Object.entries(previewData).filter(([, rows]) => rows.length > 0).map(([type, rows]) => (
                  <div key={type} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2"><span className="text-lg">{typeIcons[type]}</span>{type} <span className="text-xs text-slate-400 font-normal">(showing first {rows.length} of {summary[type]})</span></h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-gray-600">
                            {Object.keys(rows[0] || {}).map(col => <th key={col} className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{col}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-gray-700/50">
                              {Object.values(row).map((val, j) => <td key={j} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(val || '').slice(0, 50)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Import Settings <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="p-6 space-y-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Import Settings</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure how duplicates are handled and which data to include.</p>
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
                      <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${duplicateHandling === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-blue-200'}`}>
                        <input type="radio" name="dup" value={opt.value} checked={duplicateHandling === opt.value} onChange={(e) => setDuplicateHandling(e.target.value)} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{opt.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Financial Year</label>
                  <div className="space-y-3">
                    {[
                      { value: 'all', label: 'All Data' },
                      { value: 'current', label: 'Current FY' },
                      { value: 'custom', label: 'Select FY' },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${financialYear === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-blue-200'}`}>
                        <input type="radio" name="fy" value={opt.value} checked={financialYear === opt.value} onChange={(e) => setFinancialYear(e.target.value)} />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                <button onClick={handleImport} className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-soft"><Play className="w-4 h-4" /> Start Import</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="p-6 space-y-8">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Importing Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while your data is being imported.</p>
              </div>
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{importTask}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{importProgress}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${importProgress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
                  </div>
                </div>
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  {importResult?.failed ? <AlertCircle className="w-8 h-8 text-amber-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{importResult?.failed ? 'Import Completed with Errors' : 'Import Completed'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your data has been imported successfully.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                {importResult?.results && Object.entries(importResult.results).filter(([, v]) => v > 0).map(([key, count]) => (
                  <div key={key} className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{count}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  </div>
                ))}
              </div>
              {importResult?.failed > 0 && <div className="text-center text-sm text-amber-600 dark:text-amber-400">Failed Records: {importResult.failed}</div>}
              {importResult?.errors?.length > 0 && (
                <div className="max-w-lg mx-auto bg-red-50 dark:bg-red-500/10 rounded-xl p-4 max-h-32 overflow-y-auto">
                  {importResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">{e}</p>)}
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button onClick={onComplete} className="px-5 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">Done</button>
                <button onClick={() => { setStep(0); setImportResult(null); setFiles([]); setParsedData({}); setValidationResults({}); setColumnMappings({}); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"><Upload className="w-4 h-4" /> Import More</button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ExcelImportWizard;
