import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Plus, X, Trash2, Save, Share2, ChevronDown, Loader2,
  StickyNote, Camera, MessageSquare, Mail, Link2,
  Calculator, Delete, Settings as SettingsIcon, GripVertical,
} from 'lucide-react';
import { expenseAPI, fetchCsrfToken } from '../services/api';
import { formatCurrency } from '../utils/format';
import useSettings from '../hooks/useSettings';

const EXPENSE_CATEGORIES = [
  'Office Supplies', 'Travel', 'Food & Beverages', 'Utilities', 'Rent',
  'Salary', 'Marketing', 'Transportation', 'Maintenance', 'Legal Fees',
  'Insurance', 'Internet', 'Telephone', 'Stationery', 'Repairs',
  'Equipment', 'Software', 'Subscriptions', 'Taxes', 'Other',
];
const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card', 'Credit', 'NEFT', 'RTGS', 'IMPS', 'Wallet'];
const DEFAULT_PAYMENT_TYPES = ['Cash', 'Bank', 'UPI', 'Cheque'];
const GST_RATES = [0, 5, 12, 18, 28];

const newItem = (id) => ({
  _id: id || Date.now() + Math.random(),
  item: '',
  quantity: 0,
  unit: '',
  rate: 0,
  amount: 0,
  gstRate: 0,
  gstAmount: 0,
});

const CreateExpense = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);
  const descInputRef = useRef(null);
  const { getPref } = useSettings();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openTabs, setOpenTabs] = useState([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [availableTypes, setAvailableTypes] = useState(DEFAULT_PAYMENT_TYPES);

  const [form, setForm] = useState({
    category: '',
    expenseNo: '',
    date: new Date().toISOString().split('T')[0],
    items: [newItem()],
    paymentType: 'Cash',
    gstEnabled: false,
    roundOffEnabled: true,
    roundOff: 0,
    description: '',
    notes: '',
  });

  const currency = getPref('general', 'businessCurrency') || 'INR';
  const decimalPlaces = parseInt(getPref('general', 'amountDecimalPlaces') || '2');
  const fmt = (amt) => formatCurrency(amt, currency, decimalPlaces);

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken();
        if (isEdit) {
          const { data } = await expenseAPI.getById(id);
          setForm({
            category: data.category || '',
            expenseNo: data.expenseNumber || '',
            date: data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0],
            items: data.items?.length ? data.items.map((i, idx) => ({
              _id: Date.now() + idx,
              item: i.item || i.name || '',
              quantity: i.quantity || i.qty || 0,
              unit: i.unit || '',
              rate: i.rate || i.price || 0,
              amount: i.amount || 0,
              gstRate: i.gstRate || 0,
              gstAmount: i.gstAmount || 0,
            })) : [newItem()],
            paymentType: data.paymentMethod ? (data.paymentMethod.charAt(0).toUpperCase() + data.paymentMethod.slice(1)) : 'Cash',
            gstEnabled: false,
            roundOffEnabled: true,
            roundOff: 0,
            description: data.description || data.notes || '',
            notes: '',
          });
          setOpenTabs([{ id: 'edit', label: `Edit Expense${data.expenseNumber ? ' #' + data.expenseNumber : ''}` }]);
        } else {
          setForm(f => ({ ...f, expenseNo: '1' }));
          setOpenTabs([{ id: '1', label: 'Expense #1' }]);
        }
      } catch (err) {
        toast.error('Failed to load');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit]);

  const calculateItem = useCallback((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const base = qty * rate;
    const gstRate = parseFloat(item.gstRate) || 0;
    const gstAmt = base * gstRate / 100;
    const amount = base + gstAmt;
    return { ...item, amount, gstAmount: gstAmt };
  }, []);

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      items[idx] = calculateItem(items[idx]);
      return { ...prev, items };
    });
  };

  const addRow = () => setForm(prev => ({ ...prev, items: [...prev.items, newItem()] }));
  const removeRow = (idx) => {
    if (form.items.length === 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, i) => {
      const qty = parseFloat(i.quantity) || 0;
      const rate = parseFloat(i.rate) || 0;
      return s + qty * rate;
    }, 0);
    const taxTotal = form.gstEnabled ? form.items.reduce((s, i) => s + (parseFloat(i.gstAmount) || 0), 0) : 0;
    let total = subtotal + taxTotal;
    let roundOff = 0;
    if (form.roundOffEnabled) {
      roundOff = Math.round(total) - total;
      total = Math.round(total);
    }
    return { subtotal, taxTotal, total, roundOff };
  }, [form.items, form.gstEnabled, form.roundOffEnabled]);

  const closeTab = (tabId) => {
    if (tabId === '1' && !isEdit) return;
    navigate('/purchases/expenses');
  };

  const addNewTab = () => {
    const newNum = openTabs.length + 1;
    setOpenTabs(prev => [...prev, { id: String(newNum), label: `Expense #${newNum}` }]);
    setForm({
      category: '', expenseNo: String(newNum), date: new Date().toISOString().split('T')[0],
      items: [newItem()], paymentType: 'Cash', gstEnabled: false,
      roundOffEnabled: true, roundOff: 0, description: '', notes: '',
    });
    navigate('/purchases/expenses/new');
  };

  const addPaymentType = (mode) => {
    if (!availableTypes.includes(mode)) setAvailableTypes(prev => [...prev, mode]);
    setForm(f => ({ ...f, paymentType: mode }));
    setShowPaymentMenu(false);
  };

  const handleSave = async (action = 'save') => {
    if (!form.category) { toast.error('Expense category is required'); return; }
    if (form.items.length === 0 || form.items.every(i => !i.item)) {
      toast.error('At least one item is required');
      return;
    }
    setSubmitting(true);
    try {
      const items = form.items.filter(i => i.item).map(i => ({
        item: i.item,
        quantity: parseFloat(i.quantity) || 0,
        rate: parseFloat(i.rate) || 0,
        amount: parseFloat(i.amount) || 0,
        gstRate: parseFloat(i.gstRate) || 0,
        gstAmount: parseFloat(i.gstAmount) || 0,
      }));
      const payload = {
        category: form.category,
        expenseNumber: form.expenseNo,
        date: form.date,
        items,
        description: form.description,
        notes: form.description,
        paymentMethod: (form.paymentType || 'Cash').toLowerCase(),
        totalAmount: totals.total,
        amount: totals.total,
        tax: totals.taxTotal,
      };
      if (isEdit) {
        await expenseAPI.update(id, payload);
        toast.success('Expense updated');
      } else {
        await expenseAPI.create(payload);
        toast.success('Expense saved');
      }
      if (action === 'save_new') addNewTab();
      else navigate('/purchases/expenses');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Top Tabs Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 pt-2 flex items-end gap-1 overflow-x-auto">
        {openTabs.map(tab => (
          <div key={tab.id}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-b-0 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-t-lg whitespace-nowrap group min-w-[160px]"
          >
            <span className="truncate">{tab.label}</span>
            <button onClick={() => closeTab(tab.id)} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addNewTab}
          className="mb-1 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors bg-white dark:bg-slate-800"
          title="Open new tab"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1 mb-1">
          <button onClick={() => setShowCalculator(true)} className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Calculator">
            <Calculator className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/settings?tab=transaction')} className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors" title="Transaction Settings">
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/purchases/expenses')} className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title Row with GST toggle */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Expense</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">GST</span>
          <button onClick={() => setForm(f => ({ ...f, gstEnabled: !f.gstEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.gstEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            title="Toggle GST"
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.gstEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Top Form Section */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border-2 border-blue-400 dark:border-blue-500 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            >
              <option value="">Select Category</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Or type custom category"
              className="w-full mt-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 dark:text-slate-400 w-24 shrink-0 text-right">Expense No</label>
              <input value={form.expenseNo} onChange={e => setForm({ ...form, expenseNo: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 dark:text-slate-400 w-24 shrink-0 text-right">Date</label>
              <div className="flex-1 relative">
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-slate-800 p-4">
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/50">
                <th className="px-2 py-3 text-center w-10">#</th>
                <th className="px-2 py-3 text-left min-w-[200px]">ITEM</th>
                <th className="px-2 py-3 text-center w-24">QTY</th>
                <th className="px-2 py-3 text-right w-32">PRICE/UNIT</th>
                <th className="px-2 py-3 text-right w-32">AMOUNT</th>
                <th className="px-2 py-3 w-10">
                  <button onClick={addRow} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Add row">
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={item._id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-2 py-2 text-center text-slate-400 text-xs font-medium align-top pt-3">
                    <div className="flex items-center gap-1 justify-center">
                      <GripVertical className="w-3 h-3 text-slate-300" />
                      <span>{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-2 py-1.5 text-sm border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    {form.gstEnabled && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-slate-500">GST</span>
                        <select value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)}
                          className="flex-1 px-1 py-0.5 text-[10px] border-b border-slate-200 dark:border-slate-600 bg-transparent focus:outline-none focus:border-blue-500"
                        >
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        <span className="text-[10px] text-slate-500 tabular-nums">+{fmt(item.gstAmount || 0)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input type="number" min="0" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top pt-3">
                    {fmt(item.amount || 0)}
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-2">
                    {form.items.length > 1 && (
                      <button onClick={() => removeRow(idx)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <td colSpan={2} className="px-3 py-3">
                  <button onClick={addRow} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors">
                    <Plus className="w-4 h-4" /> ADD ROW
                  </button>
                </td>
                <td className="px-2 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL</td>
                <td className="px-2 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                  {form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)}
                </td>
                <td className="px-2 py-3 text-right text-sm font-bold text-slate-900 dark:text-slate-100">
                  {fmt(totals.total)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Add buttons */}
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
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-1 py-1 transition-colors"
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
              <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { setImageFile(e.target.files[0]); toast.success('Image added'); }} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${imageFile ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}
              >
                <Camera className="w-3.5 h-3.5" />
                {imageFile ? `✓ ${imageFile.name.slice(0, 16)}...` : 'ADD IMAGE'}
              </button>
            </div>
          </div>

          {/* Right: Totals */}
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-2 text-sm py-1">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums">{fmt(totals.subtotal)}</span>
            </div>
            {form.gstEnabled && totals.taxTotal > 0 && (
              <div className="flex items-center justify-end gap-2 text-sm py-1">
                <span className="text-slate-500">GST</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums">{fmt(totals.taxTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 text-sm py-2 border-t border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                <input type="checkbox" checked={form.roundOffEnabled} onChange={e => setForm({ ...form, roundOffEnabled: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Round Off</span>
              </label>
              <input type="number" step="0.01" value={totals.roundOff.toFixed(2)} readOnly
                className="w-24 px-2 py-1 text-sm text-right border-b border-slate-300 bg-transparent"
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-base font-bold py-2 border-t-2 border-slate-300 dark:border-slate-600">
              <span className="text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums text-lg">{fmt(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Share + Save */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex items-center justify-end gap-2">
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
        <button onClick={() => handleSave('save')} disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Description Modal */}
      <AnimatePresence>
        {showDesc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDesc(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Description</h3>
                <button onClick={() => setShowDesc(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <textarea ref={descInputRef} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6}
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

      {/* Calculator */}
      <CalculatorPopup
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        onUse={(value) => {
          setForm(f => ({ ...f, items: [...f.items, newItem(Date.now())].map((it, idx) => idx === f.items.length ? { ...it, rate: parseFloat(value.toFixed(2)), quantity: 1, item: it.item || 'Calculator total', amount: parseFloat(value.toFixed(2)) } : it) }));
          setShowCalculator(false);
          toast.success('Amount added as new item');
        }}
      />
    </div>
  );
};

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
  const equals = () => {
    if (operator == null || previous == null) return;
    const result = compute(previous, parseFloat(display), operator);
    setDisplay(String(round(result)));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  useEffect(() => { if (!open) clearAll(); }, [open]);

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
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}>
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
                {operator && previous != null && <p className="text-xs text-slate-400 mt-0.5">{previous} {operator}</p>}
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
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
                Use {formatCurrency(currentValue)} as Item
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">Keyboard: 0-9 + − × ÷ % Enter = Esc C ⌫</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateExpense;
