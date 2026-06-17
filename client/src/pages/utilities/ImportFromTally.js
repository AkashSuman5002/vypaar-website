import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Database, FileSpreadsheet, ArrowRight, Upload, Download } from 'lucide-react';
import { importAPI } from '../../services/api';

const ImportFromTally = () => {
  const [selectedMethod, setSelectedMethod] = useState('xml');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xml') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.xlsx'))) {
      handleUpload(droppedFile);
    } else { toast.error('Please upload .xml, .xls, or .xlsx file'); }
  };

  const handleFileSelect = (e) => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
  };

  const handleUpload = async (uploadFile) => {
    setFile(uploadFile); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('type', 'tally');
      const res = await importAPI.excelUpload(fd);
      setImportResult(res.data);
      toast.success('Tally file uploaded! Review and confirm import.');
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleImport = async () => {
    try {
      await importAPI.excelExecute({ type: 'tally', fileId: importResult?.fileId });
      toast.success('Tally data imported successfully!');
      setImportResult(null); setFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
  };

  const downloadTemplate = () => {
    const headers = ['Ledger Name', 'Ledger Group', 'Opening Balance', 'Dr/Cr', 'Voucher Type', 'Date', 'Party Name', 'Amount'];
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tally_import_template.csv'; a.click();
    window.URL.revokeObjectURL(url); toast.success('Template downloaded!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mb-6">Import From Tally</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mb-8">
        {[{ id: 'xml', title: 'Import From Tally XML', desc: 'Import data from Tally ERP 9 / TallyPrime XML export files. Supports Ledger, Stock Item, Voucher types.', icon: Database, color: 'blue' },
          { id: 'excel', title: 'Import From Excel (Tally Format)', desc: 'Import data from Excel files exported from Tally or prepared in Tally-compatible format.', icon: FileSpreadsheet, color: 'emerald' }].map(m => (
          <motion.div key={m.id} whileHover={{ y: -2 }} onClick={() => setSelectedMethod(m.id)} className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedMethod === m.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-lg' : 'border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:shadow-md'}`}>
            {selectedMethod === m.id && <div className="absolute top-3 right-3"><div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div></div>}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${m.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}><m.icon className="w-8 h-8" /></div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-2">{m.title}</h3>
            <p className="text-sm text-slate-500 dark:text-[#64748B] leading-relaxed">{m.desc}</p>
          </motion.div>
        ))}
      </div>
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-4">Upload Tally Export File</h3>
        {importResult ? (
          <div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">File "{file?.name}" uploaded successfully. Review and click Import.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setImportResult(null); setFile(null); }} className="px-5 py-2.5 border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors">Cancel</button>
              <button onClick={handleImport} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Import Data</button>
            </div>
          </div>
        ) : (
          <div>
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-[#334155] hover:border-slate-400 dark:hover:border-[#475569]'}`}
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 text-slate-400 dark:text-[#64748B] mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-[#64748B]">Drag and drop your Tally export file here, or <span className="text-blue-600 font-medium">browse</span></p>
              <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">Supports .xml, .xls, .xlsx files</p>
              {uploading && <p className="text-sm text-blue-600 mt-3">Uploading...</p>}
              <input ref={fileInputRef} type="file" accept=".xml,.xls,.xlsx" onChange={handleFileSelect} className="hidden" />
            </div>
            <div className="flex justify-center mt-4 gap-3">
              <button onClick={downloadTemplate} className="px-5 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download Template</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ImportFromTally;
