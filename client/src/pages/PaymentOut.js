import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Trash2, X, ChevronLeft, ChevronRight,
  Save, Share2, Loader2, Wallet, ChevronDown,
  StickyNote, Camera, MessageSquare, Mail, Link2,
  Calculator, Delete, Settings as SettingsIcon,
} from 'lucide-react';
import { supplierAPI, paymentOutAPI, fetchCsrfToken } from '../services/api';

const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card', 'Credit', 'NEFT', 'RTGS', 'IMPS', 'Wallet'];
const DEFAULT_PAYMENT_TYPES = ['Cash', 'Bank', 'UPI', 'Cheque'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const PaymentOut = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);
  const pageSize = 10;

  const [form, setForm] = useState({
    party: '',
    partyName: '',
    paymentType: 'Cash',
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paidAmount: '',
  });
  const [showDesc, setShowDesc] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [availableTypes, setAvailableTypes] = useState(DEFAULT_PAYMENT_TYPES);
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await paymentOutAPI.getAll({});
      setPayments(res.data.payments || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken();
        const supRes = await supplierAPI.getAll().catch(() => ({ data: [] }));
        const supData = Array.isArray(supRes.data) ? supRes.data : supRes.data?.suppliers || [];
        setSuppliers(supData);
      } catch (e) { /* ignore */ }
      fetchPayments();
    };
    init();
  }, [fetchPayments]);

  const resetForm = () => {
    setForm({
      party: '',
      partyName: '',
      paymentType: 'Cash',
      receiptNo: `1`,
      date: new Date().toISOString().split('T')[0],
      description: '',
      paidAmount: '',
    });
    setAvailableTypes(DEFAULT_PAYMENT_TYPES);
    setShowDesc(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handlePartySelect = (id) => {
    const sup = suppliers.find(s => s._id === id);
    setForm(f => ({ ...f, party: id, partyName: sup?.name || '' }));
  };

  const addPaymentType = (mode) => {
    if (!availableTypes.includes(mode)) setAvailableTypes(prev => [...prev, mode]);
    setForm(f => ({ ...f, paymentType: mode }));
    setShowPaymentMenu(false);
  };

  const handleSave = async () => {
    if (!form.partyName) { toast.error('Party is required'); return; }
    if (!form.paidAmount || parseFloat(form.paidAmount) <= 0) { toast.error('Paid amount is required'); return; }
    setSubmitting(true);
    const methodForAPI = form.paymentType.toLowerCase() === 'cash' ? 'cash' : 'bank';
    const payload = {
      partyName: form.partyName,
      paymentMethod: methodForAPI,
      reference: form.receiptNo,
      date: form.date,
      description: form.description,
      amount: parseFloat(form.paidAmount) || 0,
    };
    try {
      const res = await paymentOutAPI.create(payload);
      const created = res.data.payment || res.data;
      setPayments(prev => [...prev, created]);
      toast.success('Payment recorded');
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await paymentOutAPI.delete(id);
      setPayments(prev => prev.filter(p => p._id !== id));
      toast.success('Payment deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete payment');
    }
  };

  const totalAmount = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const filtered = payments.filter(p => {
    const q = searchQuery.toLowerCase();
    return !q || p.partyName?.toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q) || p.paymentMethod?.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Payment Out</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Record outgoing payments to suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Payment Out</button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by party, receipt no or payment type..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </motion.div>

      {payments.length === 0 ? (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mb-5">
              <Wallet className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">No Transactions to Show</h3>
            <p className="text-sm text-slate-500 mb-6">Record your first outgoing payment to a supplier or vendor.</p>
            <button onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            ><Plus className="w-4 h-4" /> Add Payment Out</button>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden"
        >
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['#', 'Date', 'Receipt No', 'Party', 'Payment Type', 'Amount', ''].map(h => (
                    <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((p, idx) => (
                  <tr key={p._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(p.date)}</td>
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 font-mono">{p.reference || '-'}</span></td>
                    <td className="px-4 py-3"><span className="text-sm font-medium text-slate-900">{p.partyName}</span></td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-slate-600 capitalize px-2 py-0.5 bg-slate-100 rounded">{p.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDelete(p._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">{filtered.length} payment{filtered.length !== 1 ? 's' : ''} · Total: <span className="font-semibold text-slate-700">{formatCurrency(totalAmount)}</span></p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"
              ><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setCurrentPage(pg)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === pg ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >{pg}</button>
              ))}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"
              ><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-3xl overflow-hidden border border-slate-200/80"
            >
              {/* Title Row matching Vyapar */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment-Out</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowCalculator(true)} className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Calculator">
                    <Calculator className="w-4 h-4" />
                  </button>
                  <button onClick={() => navigate('/settings?tab=transaction')} className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors" title="Transaction Settings">
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-6 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Party <span className="text-red-500">*</span>
                    </label>
                    <select value={form.party} onChange={e => handlePartySelect(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border-2 border-blue-400 dark:border-blue-500 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    >
                      <option value="">Select Party</option>
                      {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-500 dark:text-slate-400 w-24 shrink-0">Receipt No</label>
                      <input value={form.receiptNo} onChange={e => setForm({ ...form, receiptNo: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-500 dark:text-slate-400 w-24 shrink-0">Date</label>
                      <div className="flex-1 relative">
                        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                          className="w-full px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-5">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5 max-w-[240px]">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Type</label>
                      <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="relative">
                      <button onClick={() => setShowPaymentMenu(!showPaymentMenu)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-1 py-1 transition-colors"
                      >
                        + Add Payment type
                      </button>
                      <AnimatePresence>
                        {showPaymentMenu && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowPaymentMenu(false)} />
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                              className="absolute z-20 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg p-1"
                            >
                              {PAYMENT_MODES.filter(m => !availableTypes.includes(m)).map(mode => (
                                <button key={mode} onClick={() => addPaymentType(mode)}
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded transition-colors"
                                >
                                  {mode}
                                </button>
                              ))}
                              {PAYMENT_MODES.every(m => availableTypes.includes(m)) && (
                                <p className="px-2 py-1.5 text-xs text-slate-400">All payment types added</p>
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <button onClick={() => setShowDesc(true)}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.description ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                        {form.description ? '✓ Description Added' : 'ADD DESCRIPTION'}
                      </button>
                    </div>

                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={e => toast.success('Image attached')} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Add Image"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <label className="text-sm text-slate-500 dark:text-slate-400 w-24 shrink-0 pt-2">Paid</label>
                    <input type="number" step="0.01" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 text-sm border-b border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 mt-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50">
                <div className="relative">
                  <button onClick={() => setShareOpen(!shareOpen)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <AnimatePresence>
                    {shareOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-1"
                        >
                          {[
                            { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600' },
                            { label: 'Email', icon: Mail, color: 'text-blue-600' },
                            { label: 'Copy Link', icon: Link2, color: 'text-slate-600' },
                          ].map(opt => (
                            <button key={opt.label} onClick={() => { toast.info(`${opt.label} share coming soon`); setShareOpen(false); }}
                              className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
                            >
                              <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={handleSave} disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDesc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDesc(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Description</h3>
                <button onClick={() => setShowDesc(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6}
                placeholder="Add a description or note..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setForm(f => ({ ...f, description: '' }))} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">Clear</button>
                <button onClick={() => setShowDesc(false)} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CalculatorPopup
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        onUse={(value) => {
          setForm(f => ({ ...f, paidAmount: String(value.toFixed(2)) }));
          setShowCalculator(false);
          toast.success('Amount applied to Paid');
        }}
      />
    </motion.div>
  );
};

export default PaymentOut;

const CalculatorPopup = ({ open, onClose, onUse }) => {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (d) => {
    if (waitingForOperand) { setDisplay(String(d)); setWaitingForOperand(false); }
    else setDisplay(display === '0' ? String(d) : display + d);
  };
  const inputDot = () => {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const clearAll = () => { setDisplay('0'); setPrevious(null); setOperator(null); setWaitingForOperand(false); };
  const backspace = () => {
    if (waitingForOperand) return;
    if (display.length === 1) setDisplay('0');
    else setDisplay(display.slice(0, -1));
  };
  const performOp = (nextOp) => {
    const inputValue = parseFloat(display);
    if (previous == null) setPrevious(inputValue);
    else if (operator) {
      const result = compute(previous, inputValue, operator);
      setDisplay(String(round(result)));
      setPrevious(parseFloat(round(result)));
    }
    setWaitingForOperand(true);
    setOperator(nextOp);
  };
  const compute = (a, b, op) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      case '%': return (a * b) / 100;
      default: return b;
    }
  };
  const round = (n) => Math.round(n * 1e10) / 1e10;
  const equals = () => {
    if (operator == null || previous == null) return;
    const result = compute(previous, parseFloat(display), operator);
    setDisplay(String(round(result)));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  useEffect(() => {
    if (!open) { clearAll(); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDot();
      else if (e.key === '+' || e.key === '-') performOp(e.key);
      else if (e.key === '*') performOp('×');
      else if (e.key === '/') { e.preventDefault(); performOp('÷'); }
      else if (e.key === '%') performOp('%');
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onClose();
      else if (e.key.toLowerCase() === 'c') clearAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, display, previous, operator, waitingForOperand]);

  const currentValue = parseFloat(display) || 0;

  const Btn = ({ children, onClick, variant = 'num', className = '' }) => {
    const variants = {
      num: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200',
      op: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100',
      eq: 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600',
      util: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
    };
    return (
      <button type="button" onClick={onClick}
        className={`h-12 rounded-lg text-base font-semibold transition-colors active:scale-95 ${variants[variant]} ${className}`}
      >{children}</button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}
        >
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <Calculator className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Calculator</h3>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-4 bg-slate-900">
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-white tabular-nums truncate">
                  {display.length > 14 ? Number(display).toExponential(6) : display}
                </p>
                {operator && previous != null && (
                  <p className="text-xs text-slate-400 mt-0.5">{previous} {operator}</p>
                )}
              </div>
            </div>

            <div className="p-3 grid grid-cols-4 gap-2">
              <Btn variant="util" onClick={clearAll}>AC</Btn>
              <Btn variant="util" onClick={backspace}><Delete className="w-4 h-4 mx-auto" /></Btn>
              <Btn variant="op" onClick={() => performOp('%')}>%</Btn>
              <Btn variant="op" onClick={() => performOp('÷')}>÷</Btn>

              <Btn variant="num" onClick={() => inputDigit(7)}>7</Btn>
              <Btn variant="num" onClick={() => inputDigit(8)}>8</Btn>
              <Btn variant="num" onClick={() => inputDigit(9)}>9</Btn>
              <Btn variant="op" onClick={() => performOp('×')}>×</Btn>

              <Btn variant="num" onClick={() => inputDigit(4)}>4</Btn>
              <Btn variant="num" onClick={() => inputDigit(5)}>5</Btn>
              <Btn variant="num" onClick={() => inputDigit(6)}>6</Btn>
              <Btn variant="op" onClick={() => performOp('-')}>−</Btn>

              <Btn variant="num" onClick={() => inputDigit(1)}>1</Btn>
              <Btn variant="num" onClick={() => inputDigit(2)}>2</Btn>
              <Btn variant="num" onClick={() => inputDigit(3)}>3</Btn>
              <Btn variant="op" onClick={() => performOp('+')}>+</Btn>

              <Btn variant="num" onClick={() => inputDigit(0)} className="col-span-2">0</Btn>
              <Btn variant="num" onClick={inputDot}>.</Btn>
              <Btn variant="eq" onClick={equals}>=</Btn>
            </div>

            <div className="px-3 pb-3">
              <button type="button" onClick={() => onUse(currentValue)}
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
              >
                Use {formatCurrency(currentValue)} as Paid
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">Keyboard: 0-9 + − × ÷ % Enter = Esc C ⌫</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
