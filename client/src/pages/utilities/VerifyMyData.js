import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { CheckCircle, AlertTriangle, RefreshCw, Database, Users, Package, ShoppingCart, Receipt, FileText, BookOpen, Wallet, BarChart3 } from 'lucide-react';
import { utilityAPI } from '../../services/api';

const MODULE_CONFIG = {
  customers: { label: 'Customers', icon: Users, color: 'blue' },
  products: { label: 'Items', icon: Package, color: 'emerald' },
  sales: { label: 'Sales', icon: ShoppingCart, color: 'purple' },
  purchases: { label: 'Purchases', icon: Receipt, color: 'amber' },
  expenses: { label: 'Expenses', icon: FileText, color: 'red' },
  journalEntries: { label: 'Journal Entries', icon: BookOpen, color: 'indigo' },
  accounts: { label: 'Chart of Accounts', icon: BarChart3, color: 'cyan' },
  stock: { label: 'Stock Movements', icon: Database, color: 'orange' },
  transactions: { label: 'Transactions', icon: Wallet, color: 'teal' },
};

const VerifyMyData = () => {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);

  const runVerification = async () => {
    setVerifying(true); setResults([]); setProgress(0);
    try {
      const res = await utilityAPI.verifyData();
      const data = res.data || {};
      const keys = Object.keys(MODULE_CONFIG);
      const newResults = [];
      for (let i = 0; i < keys.length; i++) {
        setProgress(((i + 1) / keys.length) * 100);
        await new Promise(r => setTimeout(r, 200));
        const key = keys[i];
        const info = data[key] || { count: 0, status: 'warning', issues: [] };
        newResults.push({ id: key, ...MODULE_CONFIG[key], count: info.count || 0, status: info.status || 'warning', issues: info.issues || [] });
      }
      setResults(newResults);
      setVerified(true);
      const allPass = newResults.every(r => r.status === 'pass');
      if (allPass) toast.success('All data checks passed!');
      else toast.warning('Some data issues found. Review below.');
    } catch (err) { toast.error(err.response?.data?.message || 'Verification failed'); }
    finally { setVerifying(false); }
  };

  const allPass = verified && results.length > 0 && results.every(r => r.status === 'pass');
  const totalIssues = results.reduce((acc, r) => acc + r.issues.length, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Verify My Data</h1>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8">
        {!verified ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6"><Database className="w-10 h-10 text-blue-600" /></div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Data Verification</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">This will check all your business data for consistency, missing fields, and potential issues across {Object.keys(MODULE_CONFIG).length} modules.</p>
            {verifying && (
              <div className="max-w-xs mx-auto mb-6">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-blue-600 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">Verifying... {Math.round(progress)}%</p>
              </div>
            )}
            <button onClick={runVerification} disabled={verifying} className="px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} /> {verifying ? 'Verifying...' : 'Start Verification'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Verification Results</h2>
              <button onClick={() => { setVerified(false); setResults([]); }} className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Re-verify</button>
            </div>
            {allPass ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6"><CheckCircle className="w-5 h-5 text-emerald-600" /><p className="text-sm font-medium text-emerald-700">All data checks passed! Your business data is consistent and complete.</p></div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6"><AlertTriangle className="w-5 h-5 text-amber-600" /><p className="text-sm font-medium text-amber-700">{totalIssues} issue(s) found across {results.filter(r => r.issues.length > 0).length} module(s). Review details below.</p></div>
            )}
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${r.status === 'pass' ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.status === 'pass' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {r.status === 'pass' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.count} record(s){r.issues.length > 0 ? ` — ${r.issues.join(', ')}` : ''}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.status === 'pass' ? 'Passed' : `${r.issues.length} Issue(s)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VerifyMyData;
