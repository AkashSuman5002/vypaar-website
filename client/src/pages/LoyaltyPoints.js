import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { Award, Gift, Plus, Minus, Sliders, X, Loader2, Search } from 'lucide-react';
import { loyaltyAPI, customerAPI } from '../services/api';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };

const ACTIONS = {
  earn: { label: 'Earn Points', icon: Plus, color: 'bg-emerald-600 hover:bg-emerald-700' },
  redeem: { label: 'Redeem Points', icon: Minus, color: 'bg-amber-600 hover:bg-amber-700' },
  adjust: { label: 'Adjust Points', icon: Sliders, color: 'bg-blue-600 hover:bg-blue-700' },
};

const LoyaltyPoints = () => {
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [modalAction, setModalAction] = useState(null); // 'earn' | 'redeem' | 'adjust'
  const [form, setForm] = useState({ customer: '', points: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await customerAPI.getAll({ limit: 1000 });
      setCustomers(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch { toast.error('Failed to load customers'); }
  }, []);

  const loadTransactions = useCallback(async (customer) => {
    setLoading(true);
    try {
      const res = await loyaltyAPI.getAll(customer ? { customer } : {});
      setTransactions(res.data?.points || []);
    } catch { toast.error('Failed to load loyalty transactions'); }
    setLoading(false);
  }, []);

  const loadBalance = useCallback(async (customerId) => {
    if (!customerId) { setBalance(null); return; }
    setBalanceLoading(true);
    try {
      const res = await loyaltyAPI.getBalance(customerId);
      setBalance(res.data);
    } catch { setBalance(null); }
    setBalanceLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadTransactions(selectedCustomer); loadBalance(selectedCustomer); }, [selectedCustomer, loadTransactions, loadBalance]);

  const openModal = (action) => {
    setModalAction(action);
    setForm({ customer: selectedCustomer || '', points: '', description: '' });
  };

  const closeModal = () => { setModalAction(null); setForm({ customer: '', points: '', description: '' }); };

  const handleSubmit = async () => {
    if (!form.customer) return toast.error('Please select a customer');
    const pointsNum = parseInt(form.points, 10);
    if (modalAction === 'adjust') {
      if (Number.isNaN(pointsNum) || pointsNum === 0) return toast.error('Enter a non-zero adjustment (use - to deduct)');
    } else if (Number.isNaN(pointsNum) || pointsNum <= 0) {
      return toast.error('Enter a positive number of points');
    }
    const customerObj = customers.find(c => c._id === form.customer);
    const payload = {
      customer: form.customer,
      customerName: customerObj?.name,
      points: pointsNum,
      description: form.description || undefined,
    };
    setSaving(true);
    try {
      if (modalAction === 'earn') await loyaltyAPI.earn(payload);
      else if (modalAction === 'redeem') await loyaltyAPI.redeem(payload);
      else await loyaltyAPI.adjust(payload);
      toast.success(`${ACTIONS[modalAction].label} successful`);
      closeModal();
      loadTransactions(selectedCustomer);
      loadBalance(selectedCustomer);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
    finally { setSaving(false); }
  };

  const badgeFor = (type) => {
    if (type === 'earn') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
    if (type === 'redeem') return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Award size={24} className="text-amber-500" /> Loyalty Points</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track and manage customer loyalty points</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(ACTIONS).map(([key, a]) => {
            const Icon = a.icon;
            return (
              <button key={key} onClick={() => openModal(key)} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${a.color}`}>
                <Icon size={16} /> {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Filter by Customer</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">All customers</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
              </select>
            </div>
          </div>
          {selectedCustomer && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Earned</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{balanceLoading ? '...' : (balance?.totalEarned ?? 0)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Redeemed</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-300">{balanceLoading ? '...' : (balance?.totalRedeemed ?? 0)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-300">{balanceLoading ? '...' : (balance?.balance ?? 0)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Points</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8"><Loader2 className="animate-spin text-blue-500 inline" size={24} /></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">No loyalty transactions found</td></tr>
              ) : transactions.map(t => (
                <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.customer?.name || t.customerName || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${badgeFor(t.transactionType)}`}>{t.transactionType}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.points}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.balance}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {modalAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Gift size={18} /> {ACTIONS[modalAction].label}</h3>
                <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer *</label>
                  <select value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c._id} value={c._id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Points *</label>
                  <input type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })}
                    placeholder={modalAction === 'adjust' ? 'e.g. 50 or -50' : 'e.g. 100'}
                    className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  {modalAction === 'adjust' && <p className="mt-1 text-xs text-gray-400">Use a negative value to deduct points.</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional note" className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                <button onClick={closeModal} className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleSubmit} disabled={saving} className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2 ${ACTIONS[modalAction].color}`}>
                  {saving && <Loader2 size={16} className="animate-spin" />}{ACTIONS[modalAction].label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LoyaltyPoints;
