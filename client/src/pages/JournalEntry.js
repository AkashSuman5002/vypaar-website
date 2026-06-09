import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { journalAPI } from '../services/api';
import {
  Plus, Search, X, ChevronLeft, ChevronRight, BookOpen,
  Save, PlusCircle, MinusCircle, FileText, Info, AlertTriangle,
  Loader2,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const JournalEntry = () => {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const [form, setForm] = useState({
    entryNumber: `JE-1`,
    entryDate: new Date().toISOString().split('T')[0],
    narration: '',
    lines: [{ account: '', particular: '', debit: 0, credit: 0 }],
  });

  const fetchEntries = async (page = 1) => {
    try {
      const params = searchQuery
        ? { page: 1, limit: 10000 }
        : { page, limit: pageSize };
      const { data } = await journalAPI.getAll(params);
      setEntries(data.entries);
      setTotalPages(data.pages);
    } catch (err) {
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(currentPage); }, [currentPage, searchQuery]);

  useEffect(() => {
    journalAPI.getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (idx, field, value) => {
    setForm(prev => {
      const lines = prev.lines.map((line, i) => i === idx ? { ...line, [field]: value } : line);
      return { ...prev, lines };
    });
  };

  const addLine = () => setForm(prev => ({
    ...prev, lines: [...prev.lines, { account: '', particular: '', debit: 0, credit: 0 }]
  }));

  const removeLine = (idx) => {
    if (form.lines.length <= 1) return;
    setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const resetForm = () => {
    setForm({
      entryNumber: `JE-${(entries.length + 1)}`,
      entryDate: new Date().toISOString().split('T')[0],
      narration: '',
      lines: [{ account: '', particular: '', debit: 0, credit: 0 }],
    });
  };

  const handleSave = async () => {
    if (!form.narration) { toast.error('Narration is required'); return; }
    if (form.lines.some(l => !l.account)) { toast.error('All lines must have an account selected'); return; }
    if (!isBalanced) { toast.error('Total Debit must equal Total Credit'); return; }
    try {
      await journalAPI.create({
        entryNumber: form.entryNumber,
        entryDate: form.entryDate,
        narration: form.narration,
        referenceType: 'journal',
        lines: form.lines.map(l => {
          const acct = accounts.find(a => a._id === l.account);
          return {
            account: l.account,
            accountName: acct?.name || '',
            accountType: acct?.type || '',
            particular: l.particular,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          };
        }),
      });
      toast.success('Journal entry created');
      setShowModal(false);
      resetForm();
      fetchEntries(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create entry');
    }
  };

  const displayEntries = searchQuery
    ? entries.filter(e => {
        const q = searchQuery.toLowerCase();
        return !q || e.narration?.toLowerCase().includes(q) || e.entryNumber?.toLowerCase().includes(q);
      })
    : entries;
  const paginated = displayEntries.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 pb-8">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Journal Entry</h1>
        </div>
      </motion.div>

      {entries.length === 0 && !showModal ? (
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
          <div className="flex flex-col items-center text-center px-6 py-12 lg:py-16">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Journal Entry</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-md">
              Now create journal vouchers in Vyapar to manage end to end accounting on Vyapar app
            </p>

            <div className="w-48 h-36 mb-8 flex items-center justify-center">
              <svg viewBox="0 0 200 160" className="w-full h-full">
                <defs>
                  <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#FEF3C7',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#FDE68A',stopOpacity:0.3}} />
                  </linearGradient>
                  <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#F59E0B',stopOpacity:0.6}} />
                    <stop offset="100%" style={{stopColor:'#D97706',stopOpacity:0.8}} />
                  </linearGradient>
                </defs>
                <ellipse cx="100" cy="140" rx="90" ry="20" fill="url(#groundGrad)" />
                <ellipse cx="100" cy="135" rx="80" ry="15" fill="#FDE68A" />
                <rect x="60" y="60" width="80" height="75" rx="4" fill="#E5E7EB" />
                <rect x="55" y="55" width="90" height="10" rx="2" fill="#9CA3AF" />
                <polygon points="100,30 50,55 150,55" fill="#9CA3AF" />
                <circle cx="100" cy="42" r="6" fill="#3B82F6" />
                <rect x="72" y="75" width="16" height="20" rx="2" fill="#9CA3AF" />
                <rect x="92" y="75" width="16" height="20" rx="2" fill="#9CA3AF" />
                <rect x="112" y="75" width="16" height="20" rx="2" fill="#9CA3AF" />
                <rect x="72" y="105" width="16" height="30" rx="2" fill="#9CA3AF" />
                <rect x="92" y="105" width="16" height="30" rx="2" fill="#9CA3AF" />
                <rect x="112" y="105" width="16" height="30" rx="2" fill="#9CA3AF" />
                <circle cx="40" cy="50" r="3" fill="#FCD34D" />
                <circle cx="160" cy="45" r="4" fill="#FCD34D" />
                <circle cx="30" cy="80" r="2" fill="#FCD34D" />
                <circle cx="170" cy="75" r="3" fill="#FCD34D" />
              </svg>
            </div>

            <p className="text-sm text-slate-700 mb-1">
              <strong>Journal vouchers are used to handle accounting transactions that generally do not occur on a day-to-day basis.</strong>
            </p>
            <p className="text-sm text-slate-500 mb-8 max-w-lg">
              They are manual entries in account books and are used for adjustments, equity management, or any other entry that cannot be handled by standard entries like sales, purchases, payments,etc.
            </p>

            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#E11D48] text-white text-sm font-semibold rounded-full hover:bg-[#BE123C] transition-all shadow-lg"
            ><Plus className="w-4 h-4" /> Add Journal Entry</button>
          </div>

          <div className="bg-amber-50 border-t border-amber-200 px-6 py-3">
            <p className="text-sm text-amber-700 text-center">
              <strong>Warning Message!</strong> This module is meant for users proficient in accounting entries. Please use this only if you have detailed knowledge on Credit-Debit system of accounting.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search transactions"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E11D48] text-white text-sm font-semibold rounded-full hover:bg-[#BE123C] transition-all shadow-lg"
              ><Plus className="w-4 h-4" /> Add Journal Entry</button>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Date', 'Entry No', 'Narration', 'Lines', 'Debit', 'Credit', ''].map(h => (
                      <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((e, idx) => (
                    <tr key={e._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(e.entryDate)}</td>
                      <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 font-mono">{e.entryNumber}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{e.narration}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.lines?.length}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(e.totalDebit)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(e.totalCredit)}</td>
                      <td className="px-4 py-3">
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="View">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{displayEntries.length} entries</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"
              ><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >{p}</button>
              ))}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"
              ><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-3">
            <p className="text-sm text-amber-700 text-center">
              <strong>Warning Message!</strong> This module is meant for users proficient in accounting entries. Please use this only if you have detailed knowledge on Credit-Debit system of accounting.
            </p>
          </div>
        </>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-3xl max-h-[92vh] overflow-hidden border"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">Journal Entry</h3>
                  <Info className="w-4 h-4 text-slate-400" />
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Reference number</label>
                    <input type="text" value={form.entryNumber} onChange={e => setForm({ ...form, entryNumber: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Journal Date</label>
                    <input type="date" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Narration</label>
                    <input type="text" value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })}
                      placeholder="Description" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left w-10">#</th>
                          <th className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">ACCOUNT</th>
                          <th className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-right">CREDIT</th>
                          <th className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-right">DEBIT</th>
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.lines.map((line, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <select value={line.account} onChange={e => updateLine(idx, 'account', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="">Select A/C</option>
                                {accounts.map(a => (
                                  <option key={a._id} value={a._id}>{a.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', e.target.value)}
                                min="0" step="0.01" placeholder="0.00"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', e.target.value)}
                                min="0" step="0.01" placeholder="0.00"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {form.lines.length > 1 && (
                                <button onClick={() => removeLine(idx)} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                                  <MinusCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                          <td colSpan="2" className="px-3 py-2.5 text-sm text-slate-700 text-right">Total</td>
                          <td className="px-3 py-2.5 text-sm text-right text-slate-900">{totalCredit.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-sm text-right text-slate-900">{totalDebit.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button onClick={addLine}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100"
                  ><PlusCircle className="w-3.5 h-3.5" /> Add Row</button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Narration / Description</label>
                  <textarea value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })}
                    placeholder="Enter narration..." rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>

                <div className={`rounded-xl p-4 flex items-center justify-between ${isBalanced ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Balance Check</span>
                    <p className={`text-xs mt-0.5 ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isBalanced ? 'Debit = Credit ✓' : 'Debit ≠ Credit — total must match'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Debit: <span className="font-semibold">{formatCurrency(totalDebit, 'INR', 2)}</span></p>
                    <p className="text-sm text-slate-600">Credit: <span className="font-semibold">{formatCurrency(totalCredit, 'INR', 2)}</span></p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={handleSave} disabled={!isBalanced}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E11D48] text-white text-sm font-semibold rounded-full hover:bg-[#BE123C] shadow-sm disabled:opacity-50"
                ><Save className="w-4 h-4" /> Save [Ctrl+S]</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default JournalEntry;
