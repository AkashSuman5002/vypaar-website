import React, { useState, useEffect } from 'react';
import { transactionAPI } from '../services/api';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion } from 'framer-motion';
import { Plus, Wallet, Landmark, TrendingUp, TrendingDown } from 'lucide-react';

const types = [
  { value: 'cash_in', label: 'Cash In', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { value: 'cash_out', label: 'Cash Out', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  { value: 'bank_in', label: 'Bank In', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { value: 'bank_out', label: 'Bank Out', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
];

const CashBank = () => {
  const [transactions, setTransactions] = useState([]);
  const [balances, setBalances] = useState({ cashBalance: 0, bankBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: 'cash_in', amount: 0, description: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [txnRes, balRes] = await Promise.all([transactionAPI.getAll(), transactionAPI.getBalance()]);
      setTransactions(txnRes.data);
      setBalances(balRes.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await transactionAPI.create(form);
      toast.success('Transaction added');
      setModal(false);
      setForm({ type: 'cash_in', amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch { toast.error('Operation failed'); }
  };

  if (loading) return <LoadingSpinner />;

  const income = transactions.filter((t) => t.type === 'cash_in' || t.type === 'bank_in').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'cash_out' || t.type === 'bank_out').reduce((s, t) => s + t.amount, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cash & Bank</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track your money movement</p>
        </div>
        <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash Balance</p><p className={`text-2xl font-bold mt-1 ${balances.cashBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(balances.cashBalance)}</p></div>
            </div>
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-3.5 h-3.5" /> {formatCurrency(income)}</span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><TrendingDown className="w-3.5 h-3.5" /> {formatCurrency(expense)}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bank Balance</p><p className={`text-2xl font-bold mt-1 ${balances.bankBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(balances.bankBalance)}</p></div>
            </div>
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-3.5 h-3.5" /> {formatCurrency(income)}</span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><TrendingDown className="w-3.5 h-3.5" /> {formatCurrency(expense)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Transaction History</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-5 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-5 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">No transactions yet</td></tr>
              ) : (
                transactions.map((t) => {
                  const typeInfo = types.find((x) => x.value === t.type);
                  const isIn = t.type === 'cash_in' || t.type === 'bank_in';
                  return (
                    <tr key={t._id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(t.date)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${typeInfo?.color || ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isIn ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {typeInfo?.label || t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{t.description || '-'}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isIn ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Transaction">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Amount (₹)</label>
            <input placeholder="0.00" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} required className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Description</label>
            <input placeholder="What is this for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Add Transaction</button>
        </form>
      </Modal>
    </motion.div>
  );
};

export default CashBank;
