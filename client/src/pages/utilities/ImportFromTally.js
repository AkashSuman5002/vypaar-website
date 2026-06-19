import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Database, FileSpreadsheet, Upload, Download } from 'lucide-react';
import { utilityAPI } from '../../services/api';

// Parse a Tally master XML export (ERP 9 / TallyPrime) into the flat payload
// the backend (POST /utilities/import-tally) expects:
//   { type: 'ledger', partyType: 'customer'|'supplier', name, openingBalance }
//   { type: 'stock', name, quantity, rate }
const parseTallyXml = (xmlString) => {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML file. Please upload a valid Tally XML export.');
  }
  const text = (el, tag) => {
    const node = el.getElementsByTagName(tag)[0];
    return node ? node.textContent.trim() : '';
  };
  const data = [];

  // Ledgers (parties). Tally groups debtors as customers, creditors as suppliers.
  Array.from(doc.getElementsByTagName('LEDGER')).forEach((ledger) => {
    const name = ledger.getAttribute('NAME') || text(ledger, 'NAME');
    if (!name) return;
    const parent = (text(ledger, 'PARENT') || text(ledger, 'LEDGERNAME')).toLowerCase();
    const partyType = parent.includes('creditor') || parent.includes('supplier') || parent.includes('payable')
      ? 'supplier' : 'customer';
    const openingBalance = parseFloat(text(ledger, 'OPENINGBALANCE')) || 0;
    data.push({ type: 'ledger', partyType, name, openingBalance });
  });

  // Stock items.
  Array.from(doc.getElementsByTagName('STOCKITEM')).forEach((item) => {
    const name = item.getAttribute('NAME') || text(item, 'NAME');
    if (!name) return;
    const openingRaw = text(item, 'OPENINGBALANCE'); // e.g. "10 Pcs"
    const quantity = parseFloat(openingRaw) || 0;
    const rate = parseFloat(text(item, 'RATE')) || 0;
    data.push({ type: 'stock', name, quantity, rate });
  });

  return data;
};

const ImportFromTally = () => {
  const [selectedMethod, setSelectedMethod] = useState('xml');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const fileInputRef = useRef(null);

  const readFile = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(f);
  });

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.xml')) {
      handleParse(droppedFile);
    } else { toast.error('Please upload a Tally .xml export file'); }
  };

  const handleFileSelect = (e) => {
    if (e.target.files[0]) handleParse(e.target.files[0]);
  };

  const handleParse = async (uploadFile) => {
    setFile(uploadFile); setUploading(true); setParsedData(null);
    try {
      const content = await readFile(uploadFile);
      const data = parseTallyXml(content);
      if (data.length === 0) {
        toast.error('No ledgers or stock items found in the XML file');
      } else {
        setParsedData(data);
        const ledgers = data.filter(d => d.type === 'ledger').length;
        const stock = data.filter(d => d.type === 'stock').length;
        toast.success(`Found ${ledgers} ledger(s) and ${stock} stock item(s). Review and import.`);
      }
    } catch (err) { toast.error(err.message || 'Failed to parse Tally file'); }
    finally { setUploading(false); }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setUploading(true);
    try {
      const res = await utilityAPI.importFromTally({ data: parsedData, type: 'tally' });
      const imp = res.data?.imported || {};
      const skipped = res.data?.skippedCount || 0;
      toast.success(`Imported ${imp.ledgers || 0} ledger(s) and ${imp.stockItems || 0} stock item(s)!${skipped ? ` ${skipped} skipped (duplicates).` : ''}`);
      setParsedData(null); setFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
    finally { setUploading(false); }
  };

  const ledgerCount = parsedData ? parsedData.filter(d => d.type === 'ledger').length : 0;
  const stockCount = parsedData ? parsedData.filter(d => d.type === 'stock').length : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mb-6">Import From Tally</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mb-8">
        {[{ id: 'xml', title: 'Import From Tally XML', desc: 'Import data from Tally ERP 9 / TallyPrime XML export files. Supports Ledger (parties) and Stock Item masters.', icon: Database, color: 'blue' },
          { id: 'excel', title: 'Import From Excel (Tally Format)', desc: 'For Excel-based imports use the Import Parties / Import Items utilities.', icon: FileSpreadsheet, color: 'emerald' }].map(m => (
          <motion.div key={m.id} whileHover={{ y: -2 }} onClick={() => setSelectedMethod(m.id)} className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedMethod === m.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-lg' : 'border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:shadow-md'}`}>
            {selectedMethod === m.id && <div className="absolute top-3 right-3"><div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div></div>}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${m.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}><m.icon className="w-8 h-8" /></div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-2">{m.title}</h3>
            <p className="text-sm text-slate-500 dark:text-[#64748B] leading-relaxed">{m.desc}</p>
          </motion.div>
        ))}
      </div>
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-4">Upload Tally XML Export File</h3>
        {parsedData ? (
          <div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">"{file?.name}" parsed successfully.</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{ledgerCount} ledger(s) (parties) and {stockCount} stock item(s) ready to import.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setParsedData(null); setFile(null); }} className="px-5 py-2.5 border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={uploading} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">{uploading ? 'Importing...' : 'Import Data'}</button>
            </div>
          </div>
        ) : (
          <div>
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-[#334155] hover:border-slate-400 dark:hover:border-[#475569]'}`}
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 text-slate-400 dark:text-[#64748B] mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-[#64748B]">Drag and drop your Tally XML export file here, or <span className="text-blue-600 font-medium">browse</span></p>
              <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">Supports .xml files (Tally master export)</p>
              {uploading && <p className="text-sm text-blue-600 mt-3">Reading...</p>}
              <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileSelect} className="hidden" />
            </div>
            <div className="mt-4 text-xs text-slate-400 dark:text-[#64748B] flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> In Tally: Gateway of Tally &gt; Display &gt; List of Accounts / Export Masters to XML.
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ImportFromTally;
