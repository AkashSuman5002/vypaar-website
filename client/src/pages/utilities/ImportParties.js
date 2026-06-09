import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Upload, FileSpreadsheet, Download, CheckCircle, ArrowRight } from 'lucide-react';
import { importAPI } from '../../services/api';

const ImportParties = () => {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xls') || f.name.endsWith('.xlsx'))) handleUpload(f);
    else toast.error('Please upload .xls or .xlsx file');
  };

  const handleFileSelect = (e) => { if (e.target.files[0]) handleUpload(e.target.files[0]); };

  const handleUpload = async (uploadFile) => {
    setFile(uploadFile); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('type', 'parties');
      const res = await importAPI.excelUpload(fd);
      setImportResult(res.data);
      toast.success('File uploaded! Review before importing.');
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleImport = async () => {
    try {
      await importAPI.excelExecute({ type: 'parties', fileId: importResult?.fileId });
      toast.success('Parties imported successfully!');
      setImportResult(null); setFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
  };

  const downloadTemplate = () => {
    const headers = ['Party Name', 'Party Type (Customer/Supplier/Both)', 'Phone', 'Email', 'GST Number', 'Address', 'State', 'Opening Balance', 'Balance Type (Dr/Cr)'];
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'parties_import_template.csv'; a.click();
    window.URL.revokeObjectURL(url); toast.success('Template downloaded!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Import Parties</h1>
      {importResult ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Preview Parties Data</h2>
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200 mb-6">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm text-emerald-700">File "{file?.name}" uploaded. Review and confirm import.</span>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setImportResult(null); setFile(null); }} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleImport} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Import Data</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8 text-center">
            <p className="text-sm text-slate-600 mb-4">Download template to prepare your data</p>
            <div className="w-20 h-24 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
            <button onClick={downloadTemplate} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download Template</button>
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
            className={`bg-white rounded-2xl border-2 border-dashed p-8 text-center transition-all h-full flex flex-col items-center justify-center cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
            onClick={() => fileInputRef.current?.click()}>
            <p className="text-sm text-slate-600 mb-4">Upload your Excel file</p>
            <div className="w-20 h-24 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4"><Upload className="w-10 h-10 text-blue-600" /></div>
            <p className="text-sm text-slate-500">Drag and drop or <span className="text-blue-600 font-medium">Click to Browse</span></p>
            <p className="text-xs text-slate-400 mt-1">.xls or .xlsx files only</p>
            {uploading && <p className="text-sm text-blue-600 mt-3">Uploading...</p>}
            <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ImportParties;
