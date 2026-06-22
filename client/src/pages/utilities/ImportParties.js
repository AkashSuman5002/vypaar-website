import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Upload, FileSpreadsheet, Download, CheckCircle } from 'lucide-react';
import { utilityAPI } from '../../services/api';

// Minimal but correct CSV parser handling quoted fields.
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(c => c.trim() !== '')) rows.push(row); }
  return rows;
};

// Map CSV rows (using the downloadable template's columns) into the payload the
// backend (POST /utilities/import-tally) expects for ledgers/parties.
const buildPartiesPayload = (rows) => {
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = (re) => header.findIndex(h => re.test(h));
  const nameIdx = idx(/party name|name/);
  const typeIdx = idx(/party type|type/);
  const phoneIdx = idx(/phone/);
  const balIdx = idx(/opening balance|balance$/);
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const name = (cols[nameIdx] || '').trim();
    if (!name) continue;
    const typeRaw = (cols[typeIdx] || '').trim().toLowerCase();
    const partyType = typeRaw.includes('supplier') ? 'supplier' : 'customer';
    const phone = phoneIdx >= 0 ? (cols[phoneIdx] || '').trim() : '';
    const openingBalance = balIdx >= 0 ? (parseFloat(cols[balIdx]) || 0) : 0;
    data.push({ type: 'ledger', partyType, name, phone, openingBalance });
  }
  return data;
};

const ImportParties = () => {
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const readFile = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(f);
  });

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith('.csv')) handleParse(f);
    else toast.error('Please upload the .csv template file');
  };

  const handleFileSelect = (e) => { if (e.target.files[0]) handleParse(e.target.files[0]); };

  const handleParse = async (uploadFile) => {
    setFile(uploadFile); setUploading(true); setParsedData(null);
    try {
      const content = await readFile(uploadFile);
      const rows = parseCsv(content);
      const data = buildPartiesPayload(rows);
      if (data.length === 0) {
        toast.error('No party rows found. Use the downloaded template format.');
      } else {
        setParsedData(data);
        toast.success(`Found ${data.length} part${data.length === 1 ? 'y' : 'ies'}. Review and confirm import.`);
      }
    } catch (err) { toast.error(err.message || 'Failed to read file'); }
    finally { setUploading(false); }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setUploading(true);
    try {
      const res = await utilityAPI.importFromTally({ data: parsedData, type: 'parties' });
      const imp = res.data?.imported || {};
      const skipped = res.data?.skippedCount || 0;
      toast.success(`Imported ${imp.ledgers || 0} part${(imp.ledgers || 0) === 1 ? 'y' : 'ies'} (${imp.customers || 0} customer(s), ${imp.suppliers || 0} supplier(s))!${skipped ? ` ${skipped} skipped (duplicates).` : ''}`);
      setParsedData(null); setFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
    finally { setUploading(false); }
  };

  const downloadTemplate = () => {
    const headers = ['Party Name', 'Party Type (Customer/Supplier)', 'Phone', 'Email', 'GST Number', 'Address', 'State', 'Opening Balance', 'Balance Type (Dr/Cr)'];
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'parties_import_template.csv'; a.click();
    window.URL.revokeObjectURL(url); toast.success('Template downloaded!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mb-6">Import Parties</h1>
      {parsedData ? (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC] mb-4">Preview Parties Data</h2>
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 mb-6">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">"{file?.name}" parsed: {parsedData.length} part{parsedData.length === 1 ? 'y' : 'ies'} ready to import.</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#334155] mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-[#111827]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 dark:text-[#64748B]">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 dark:text-[#64748B]">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 dark:text-[#64748B]">Phone</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 dark:text-[#64748B]">Opening Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#334155]">
                {parsedData.slice(0, 50).map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-800 dark:text-[#E2E8F0]">{p.name}</td>
                    <td className="px-4 py-2 capitalize text-slate-600 dark:text-[#94A3B8]">{p.partyType}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-[#94A3B8]">{p.phone || '-'}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-[#94A3B8]">{p.openingBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setParsedData(null); setFile(null); }} className="px-5 py-2.5 border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors">Cancel</button>
            <button onClick={handleImport} disabled={uploading} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">{uploading ? 'Importing...' : 'Import Data'}</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-[#94A3B8] mb-4">Download template to prepare your data</p>
            <div className="w-20 h-24 bg-blue-100 dark:bg-blue-500/15 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
            <button onClick={downloadTemplate} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download Template</button>
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
            className={`bg-white dark:bg-[#1E293B] rounded-2xl border-2 border-dashed p-8 text-center transition-all h-full flex flex-col items-center justify-center cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-[#334155] hover:border-slate-400 dark:hover:border-[#475569]'}`}
            onClick={() => fileInputRef.current?.click()}>
            <p className="text-sm text-slate-600 dark:text-[#94A3B8] mb-4">Upload your filled CSV template</p>
            <div className="w-20 h-24 bg-blue-100 dark:bg-blue-500/15 rounded-xl flex items-center justify-center mx-auto mb-4"><Upload className="w-10 h-10 text-blue-600" /></div>
            <p className="text-sm text-slate-500 dark:text-[#64748B]">Drag and drop or <span className="text-blue-600 font-medium">Click to Browse</span></p>
            <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">.csv files only</p>
            {uploading && <p className="text-sm text-blue-600 mt-3">Reading...</p>}
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ImportParties;
