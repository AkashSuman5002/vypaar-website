import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Calendar, AlertTriangle, CheckCircle, ArrowRight, Lock, IndianRupee, TrendingUp, TrendingDown } from 'lucide-react';
import { utilityAPI } from '../../services/api';

const CloseFinancialYear = () => {
  const [step, setStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [closing, setClosing] = useState(false);
  const [fyStatus, setFyStatus] = useState(null);
  const [closingResult, setClosingResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    utilityAPI.getFinancialYearStatus().then(r => setFyStatus(r.data)).catch(() => {
      setFyStatus({ currentFY: '2025-26', nextFY: '2026-27', isOpen: true, totalEntries: 0 });
    }).finally(() => setLoading(false));
  }, []);

  const steps = [{ title: 'Review' }, { title: 'Confirm' }, { title: 'Complete' }];

  const handleClose = async () => {
    if (confirmText !== 'CLOSE') { toast.error('Please type CLOSE to confirm'); return; }
    setClosing(true);
    try {
      const res = await utilityAPI.closeFinancialYear({ confirmation: 'CLOSE' });
      setClosingResult(res.data);
      setStep(2);
      toast.success('Financial year closed successfully!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to close'); }
    finally { setClosing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  const fy = fyStatus || { currentFY: '2025-26', nextFY: '2026-27', isOpen: true, totalEntries: 0 };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Close Financial Year</h1>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-4 mb-8">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= i ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{step > i ? <CheckCircle className="w-4 h-4" /> : i + 1}</div>
                  <span className={`text-sm font-medium ${step >= i ? 'text-slate-900' : 'text-slate-400'}`}>{s.title}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${step > i ? 'bg-blue-600' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {step === 0 && (
            <div>
              <div className="flex items-center gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Important: This action cannot be undone</p>
                  <p className="text-xs text-amber-600 mt-1">Closing will freeze all transactions in {fy.currentFY}, create closing entries, and start {fy.nextFY} with carried-forward balances.</p>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-4">Financial Year Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400">Current Financial Year</p><p className="text-lg font-bold text-slate-900">{fy.currentFY}</p><p className="text-xs text-slate-400 mt-1">{fy.startDate} to {fy.endDate}</p></div>
                <div className="p-4 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400">Next Financial Year</p><p className="text-lg font-bold text-slate-900">{fy.nextFY}</p><p className="text-xs text-slate-400 mt-1">Opens on {parseInt(fy.endDate?.slice(0, 4) || '2026') + 1}-04-01</p></div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-xl text-center"><p className="text-xs text-blue-500 mb-1">Journal Entries</p><p className="text-2xl font-bold text-blue-700">{fy.totalEntries || 0}</p></div>
                <div className="p-4 bg-emerald-50 rounded-xl text-center"><p className="text-xs text-emerald-500 mb-1">Status</p><p className="text-lg font-bold text-emerald-700">{fy.isOpen ? 'Open' : 'Closed'}</p></div>
                <div className="p-4 bg-purple-50 rounded-xl text-center"><p className="text-xs text-purple-500 mb-1">Year</p><p className="text-lg font-bold text-purple-700">{fy.isOpen ? 'Active' : 'Closed'}</p></div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mb-3">What will happen:</h3>
              <ul className="space-y-2 mb-6">
                {[
                  'Closing journal entry will be created for P&L transfer',
                  `All transactions in ${fy.currentFY} will be frozen`,
                  'Opening balances will be carried forward to ' + fy.nextFY,
                  'Retained earnings will be updated',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {item}</li>
                ))}
              </ul>
              <div className="flex justify-end"><button onClick={() => setStep(1)} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button></div>
            </div>
          )}

          {step === 1 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-red-600" /></div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Close Financial Year {fy.currentFY}?</h3>
              <p className="text-sm text-slate-500 mb-6">This will create a closing entry and freeze all transactions. Type <span className="font-bold text-red-600">CLOSE</span> to confirm.</p>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-48 px-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mb-6" placeholder="Type CLOSE" />
              <div className="flex justify-center gap-3">
                <button onClick={() => { setStep(0); setConfirmText(''); }} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">Go Back</button>
                <button onClick={handleClose} disabled={confirmText !== 'CLOSE' || closing} className="px-6 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">{closing ? 'Closing...' : 'Close Financial Year'}</button>
              </div>
            </div>
          )}

          {step === 2 && closingResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-8 h-8 text-emerald-600" /></div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Financial Year Closed!</h3>
              <p className="text-sm text-slate-500 mb-6">{fy.currentFY} has been closed. Closing entry <span className="font-mono text-blue-600">{closingResult.closingEntry}</span> has been created.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl"><p className="text-xs text-emerald-500">Total Income</p><p className="text-sm font-bold text-emerald-700">₹{(closingResult.totalIncome || 0).toLocaleString('en-IN')}</p></div>
                <div className="p-3 bg-red-50 rounded-xl"><p className="text-xs text-red-500">Total Expense</p><p className="text-sm font-bold text-red-700">₹{(closingResult.totalExpense || 0).toLocaleString('en-IN')}</p></div>
                <div className="p-3 bg-blue-50 rounded-xl"><p className="text-xs text-blue-500">Net Profit</p><p className="text-sm font-bold text-blue-700">₹{(closingResult.netProfit || 0).toLocaleString('en-IN')}</p></div>
              </div>
              <button onClick={() => { setStep(0); setConfirmText(''); setClosingResult(null); setFyStatus(prev => prev ? { ...prev, currentFY: prev.nextFY, totalEntries: 0 } : null); }} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CloseFinancialYear;
