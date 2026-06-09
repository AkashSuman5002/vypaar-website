import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Download, Printer, Eye, Pencil, Trash2, X,
  ChevronLeft, ChevronRight, IndianRupee, FileText, Receipt,
  Percent, Save, Share2, Wallet, Tag, Calendar, Loader2,
} from 'lucide-react';
import { expenseAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const EXPENSE_CATEGORIES = [
  'Office Supplies', 'Travel', 'Food & Beverages', 'Utilities', 'Rent',
  'Salary', 'Marketing', 'Transportation', 'Maintenance', 'Legal Fees',
  'Insurance', 'Internet', 'Telephone', 'Stationery', 'Other',
];

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 10;

  const [items, setItems] = useState([{ name: '', qty: 1, price: 0, amount: 0 }]);
  const [showGst, setShowGst] = useState(false);
  const [form, setForm] = useState({
    category: '', expenseNo: '', date: new Date().toISOString().split('T')[0],
    paymentType: 'cash', roundOff: 0, total: 0,
  });

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { page: currentPage, limit: pageSize };
        if (searchQuery) params.search = searchQuery;
        const res = await expenseAPI.getAll(params);
        const data = res.data;
        setExpenses(data.expenses || []);
        setTotalPages(data.pages || 1);
        setTotalCount(data.total || 0);
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to fetch expenses';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, [currentPage, searchQuery, refreshKey]);

  const calcItemAmount = (item) => (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.amount = calcItemAmount(updated);
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, { name: '', qty: 1, price: 0, amount: 0 }]);
  const removeItem = (idx) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const grandTotal = totalAmount + (parseFloat(form.roundOff) || 0);

  const resetForm = () => {
    setForm({
      category: '', expenseNo: `EXP-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString().split('T')[0], paymentType: 'cash', roundOff: 0, total: 0,
    });
    setItems([{ name: '', qty: 1, price: 0, amount: 0 }]);
    setShowGst(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.category) { toast.error('Category is required'); return; }
    if (items.every(i => !i.name)) { toast.error('At least one item is required'); return; }
    try {
      const payload = {
        category: form.category,
        expenseNumber: form.expenseNo,
        date: form.date,
        paymentMethod: form.paymentType,
        totalAmount: grandTotal,
        description: items.map(i => i.name).filter(Boolean).join(', '),
        items: items.filter(i => i.name).map(i => ({
          name: i.name,
          quantity: parseFloat(i.qty) || 1,
          price: parseFloat(i.price) || 0,
          amount: parseFloat(i.amount) || 0,
        })),
      };
      if (editing) {
        await expenseAPI.update(editing._id, payload);
        toast.success('Expense updated');
      } else {
        await expenseAPI.create(payload);
        toast.success('Expense added');
      }
      setShowModal(false);
      resetForm();
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expenseAPI.delete(id);
      toast.success('Expense deleted');
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);

  if (loading && expenses.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track all business expenses</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 lg:p-16 flex items-center justify-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </motion.div>
      </motion.div>
    );
  }

  if (error && expenses.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track all business expenses</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all"
            >Retry</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (expenses.length === 0 && !showModal) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track all business expenses</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/5 rounded-full flex items-center justify-center mb-6">
              <Receipt className="w-12 h-12 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Add your 1st Expense</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Record business expenses to track where your money goes.</p>
            <button onClick={() => navigate('/purchases/expenses/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4.5 h-4.5" /> Add Expense</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track all business expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const headers = ['Date', 'Expense No', 'Category', 'Description', 'Payment', 'Total'];
            const rows = expenses.map(e => [
              new Date(e.date).toLocaleDateString(),
              e.expenseNumber,
              e.category,
              `"${(e.description || '').replace(/"/g, '""')}"`,
              e.paymentMethod,
              e.totalAmount
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            toast.success('Expenses exported');
          }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => navigate('/purchases/expenses/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Expense</button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><IndianRupee className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Expenses</p><p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalExpenses)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-xl"><Tag className="w-5 h-5 text-orange-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Categories</p><p className="text-xl font-bold text-slate-900 mt-1">{new Set(expenses.map(e => e.category)).size}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><FileText className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Entries</p><p className="text-xl font-bold text-slate-900 mt-1">{totalCount}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search expenses by category or item..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Date', 'Expense No', 'Category', 'Items', 'Payment', 'Total', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></td></tr>
              )}
              {!loading && expenses.map((exp, idx) => (
                <tr key={exp._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(exp.date)}</td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 font-mono">{exp.expenseNumber}</span></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-semibold rounded-md">{exp.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{(exp.items?.length || (exp.description ? 1 : 0))} item{(exp.items?.length || (exp.description ? 1 : 0)) !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-600 capitalize">{exp.paymentMethod}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900">{formatCurrency(exp.totalAmount)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => {
                        const detail = [
                          `Category: ${exp.category}`,
                          `Expense No: ${exp.expenseNumber}`,
                          `Date: ${formatDate(exp.date)}`,
                          `Payment: ${exp.paymentMethod}`,
                          `Amount: ${formatCurrency(exp.totalAmount)}`,
                          exp.description ? `Description: ${exp.description}` : '',
                        ].filter(Boolean).join('\n');
                        alert(detail);
                      }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => {
                          setEditing(exp);
                          setForm({
                            category: exp.category || '',
                            expenseNo: exp.expenseNumber || '',
                            date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            paymentType: exp.paymentMethod || 'cash',
                            roundOff: 0,
                            total: exp.totalAmount || 0,
                          });
                          setItems(exp.items?.length ? exp.items.map(i => ({
                            name: i.name || '',
                            qty: i.quantity || 1,
                            price: i.price || 0,
                            amount: i.amount || 0,
                          })) : exp.description ? [{ name: exp.description, qty: 1, price: exp.totalAmount || 0, amount: exp.totalAmount || 0 }] : [{ name: '', qty: 1, price: 0, amount: 0 }]);
                          setShowModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(exp._id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && expenses.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{totalCount} expenses</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"
          ><ChevronLeft className="w-4 h-4" /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >{p}</button>
          ))}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-2xl max-h-[92vh] overflow-hidden border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">{editing ? 'Edit Expense' : 'Add Expense'}</h3>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                ><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Expense No</label>
                    <input type="text" value={form.expenseNo} onChange={e => setForm({ ...form, expenseNo: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>

                {/* GST Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Percent className="w-5 h-5 text-slate-500" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Apply GST</h4>
                      <p className="text-xs text-slate-500">Include GST in expense calculation</p>
                    </div>
                  </div>
                  <button onClick={() => setShowGst(!showGst)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${showGst ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${showGst ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">Expense Items</h4>
                    <button onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                    ><Plus className="w-3.5 h-3.5" /> Add Row</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          {['#', 'Item', 'Qty', 'Price/Unit', 'Amount'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                          ))}
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                                placeholder="Item description"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                                min="1"
                                className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)}
                                min="0" step="0.01"
                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</td>
                            <td className="px-3 py-2">
                              {items.length > 1 && (
                                <button onClick={() => removeItem(idx)}
                                  className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                ><X className="w-3.5 h-3.5" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Payment Type</label>
                    <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="credit">Credit Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Round Off</label>
                    <input type="number" value={form.roundOff} onChange={e => setForm({ ...form, roundOff: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Total</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >Cancel</button>
                <button onClick={() => {
                  const total = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
                  const msg = `Expense Summary:\nTotal: ${formatCurrency(total)}\nEntries: ${expenses.length}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all"
                ><Share2 className="w-4 h-4" /> Share</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                ><Save className="w-4 h-4" /> Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Expenses;
