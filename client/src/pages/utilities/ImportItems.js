import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, Database, ArrowRight, History, Upload, X } from 'lucide-react';
import ExcelImportWizard from '../../components/Import/ExcelImportWizard';
import VyaparBackupImportWizard from '../../components/Import/VyaparBackupImportWizard';
import ImportHistory from '../ImportHistory';

const ImportItems = () => {
  const [activeWizard, setActiveWizard] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  if (showHistory) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
        <button onClick={() => setShowHistory(false)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to Import
        </button>
        <ImportHistory />
      </motion.div>
    );
  }

  if (activeWizard) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
        <button onClick={() => setActiveWizard(null)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to Import Methods
        </button>
        {activeWizard === 'excel' ? <ExcelImportWizard onComplete={() => setActiveWizard(null)} /> : <VyaparBackupImportWizard onComplete={() => setActiveWizard(null)} />}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Import Items</h1>
          <p className="text-sm text-slate-400 mt-0.5">Migrate your business data into this application.</p>
        </div>
        <button onClick={() => setShowHistory(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all shadow-sm">
          <History className="w-4 h-4" /> Import History
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div whileHover={{ y: -2 }} className="group bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-all hover:shadow-lg hover:border-blue-200">
          <div className="p-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
              <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Import From Excel</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Upload Excel files exported from Vyapar. Supports Parties, Items, Sales, Purchases, Expenses, and Stock data.</p>
            <ul className="space-y-2 mb-6">
              {['Parties.xlsx', 'Items.xlsx', 'Sales.xlsx', 'Purchases.xlsx', 'Expenses.xlsx', 'Stock.xlsx'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button onClick={() => setActiveWizard('excel')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-soft">
              <Upload className="w-4 h-4" /> Start Excel Import
            </button>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="group bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-all hover:shadow-lg hover:border-emerald-200">
          <div className="p-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
              <Database className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Import From Vyapar Backup</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Import directly from Vyapar backup files. Supports .backup, .zip, .db, and .sqlite formats.</p>
            <ul className="space-y-2 mb-6">
              {['Auto-detect Vyapar version', 'Scan all data tables', 'Transform to app schema', 'Preserve relationships', 'Import history tracking'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button onClick={() => setActiveWizard('backup')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-soft">
              <Database className="w-4 h-4" /> Start Backup Import
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ImportItems;
