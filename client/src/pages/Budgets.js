import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/format';
import {
  Plus, Wallet, TrendingUp, AlertTriangle, X, Pencil, Trash2,
  Loader2, BarChart3, TrendingDown, CheckCircle, Search,
} from 'lucide-react';
import { budgetAPI } from '../services/api';

const CATEGORIES = [
  'Rent', 'Salary', 'Utilities', 'Marketing', 'Travel', 'Office Supplies',
  'Software', 'Maintenance', 'Other',
];

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const Budgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState('');

  const [form, setForm] = useState({
    category: 'Other', amount: '', period: 'monthly', month: currentMonth, year: currentYear, alertThreshold: 80, notes: '',
  });

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const params = { year: filterYear };
      if (filterMonth) params.month = filterMonth;
      const res = await budgetAPI.getAll(params);
      setBudgets(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch budgets');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await budgetAPI.getAlerts();
      setAlerts(res.data || []);
    } catch (err) { /* silent */ }
  };

  useEffect(() => {
    fetchBudgets();
    fetchAlerts();
  }, [filterYear, filterMonth, refreshKey]);

  const filteredBudgets = useMemo(() => {
    if (!searchQuery.trim()) return budgets;
    const q = searchQuery.toLowerCase();
    return budgets.filter(b => b.category.toLowerCase().includes(q));
  }, [budgets, searchQuery]);

  const summary = useMemo(() => {
    let totalBudget = 0, totalSpent = 0, overBudget = 0;
    budgets.forEach(b => {
      totalBudget += b.amount;
      totalSpent += b.spent;
      if (b.spent > b.amount) overBudget++;
    });
    return { totalBudget, totalSpent, remaining: totalBudget - totalSpent, overBudget };
  }, [budgets]);

  const openAdd = () => {
    setEditing(null);
    setForm({ category: 'Other', amount: '', period: 'monthly', month: currentMonth, year: currentYear, alertThreshold: 80, notes: '' });
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      category: b.category, amount: b.amount, period: b.period, month: b.month || currentMonth,
      year: b.year, alertThreshold: b.alertThreshold, notes: b.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) return toast.error('Enter a valid amount');
    try {
      if (editing) {
        await budgetAPI.update(editing._id, form);
        toast.success('Budget updated');
      } else {
        await budgetAPI.create(form);
        toast.success('Budget created');
      }
      setShowModal(false);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save budget');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;
    try {
      await budgetAPI.delete(id);
      toast.success('Budget deleted');
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error('Failed to delete budget');
    }
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= (budgets.find(b => true)?.alertThreshold || 80)) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusTextColor = (percentage) => {
    if (percentage >= 100) return 'text-red-600 dark:text-red-400';
    if (percentage >= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getPercentage = (spent, amount) => amount > 0 ? Math.round((spent / amount) * 100) : 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-[#0F172A] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Expense Budgets</h1>
            <p className="text-sm text-gray-500 dark:text-[#64748B] mt-1">Set and track spending limits by category</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search budgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] placeholder-gray-400 dark:placeholder-[#64748B] focus:outline-none focus:border-blue-500 dark:focus:border-[#3B82F6] focus:ring-1 focus:ring-blue-500 transition-colors w-48"
              />
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus size={16} /> Add Budget
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500">
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>

        {/* Summary Cards */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Budget', value: summary.totalBudget, icon: Wallet, color: 'text-blue-600 dark:text-[#3B82F6]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Total Spent', value: summary.totalSpent, icon: TrendingDown, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
            { label: 'Remaining', value: summary.remaining, icon: TrendingUp, color: summary.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400', bg: summary.remaining >= 0 ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10' },
            { label: 'Over Budget', value: summary.overBudget, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', isCount: true },
          ].map((card, i) => (
            <motion.div key={card.label} variants={itemVariants} className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[#64748B]">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.isCount ? card.value : formatCurrency(card.value)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Budget Alerts ({alerts.length})</h3>
            </div>
            <div className="space-y-2">
              {alerts.map(b => (
                <div key={b._id} className="flex items-center justify-between text-sm">
                  <span className="text-yellow-700 dark:text-yellow-300">{b.category} ({b.period}{b.month ? ` - ${MONTHS[b.month - 1]}` : ''} {b.year})</span>
                  <span className="font-semibold text-yellow-800 dark:text-yellow-200">{b.percentage}% used — {formatCurrency(b.spent)} of {formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budgets Table */}
        <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#334155]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Period</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Budget</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Spent</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Remaining</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">% Used</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></td></tr>
                ) : filteredBudgets.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">No budgets found</td></tr>
                ) : (
                  filteredBudgets.map((b) => {
                    const pct = getPercentage(b.spent, b.amount);
                    const remaining = b.amount - b.spent;
                    return (
                      <motion.tr key={b._id} variants={itemVariants} className="border-b border-gray-50 dark:border-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
                              <Wallet size={14} className="text-blue-600 dark:text-[#3B82F6]" />
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-[#F8FAFC]">{b.category}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium text-gray-600 dark:text-[#94A3B8] capitalize">{b.period}{b.month ? ` - ${MONTHS[b.month - 1]}` : ''} {b.year}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">{formatCurrency(b.amount)}</td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-gray-700 dark:text-[#CBD5E1]">{formatCurrency(b.spent)}</td>
                        <td className={`px-5 py-3 text-right text-sm font-semibold ${remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(remaining)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-sm font-bold ${getStatusTextColor(pct)}`}>{pct}%</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-center">
                            <div className="w-20 h-2 bg-gray-200 dark:bg-[#334155] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getStatusColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#334155] transition-colors" title="Edit">
                              <Pencil size={14} className="text-gray-500 dark:text-[#64748B]" />
                            </button>
                            <button onClick={() => handleDelete(b._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-[#334155] w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#334155]">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">{editing ? 'Edit Budget' : 'Add Budget'}</h2>
                  <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#334155] transition-colors">
                    <X size={18} className="text-gray-500 dark:text-[#64748B]" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Budget Amount (₹)</label>
                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Enter budget amount" required min="0" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Period</label>
                      <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Year</label>
                      <select value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  {(form.period === 'monthly' || form.period === 'quarterly') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Month</label>
                      <select value={form.month} onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Alert Threshold (%)</label>
                    <input type="number" value={form.alertThreshold} onChange={(e) => setForm({ ...form, alertThreshold: parseInt(e.target.value) || 80 })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="1" max="100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" rows="2" placeholder="Optional notes" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#CBD5E1] bg-gray-100 dark:bg-[#334155] rounded-xl hover:bg-gray-200 dark:hover:bg-[#475569] transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">{editing ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Budgets;
