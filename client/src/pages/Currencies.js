import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { Plus, Coins, X, Pencil, Trash2, Loader2, Star } from 'lucide-react';
import { currencyAPI } from '../services/api';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };

const Currencies = () => {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { code: '', name: '', symbol: '', exchangeRate: 1, isBase: false };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await currencyAPI.getAll();
      setCurrencies(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch { toast.error('Failed to load currencies'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ code: c.code || '', name: c.name || '', symbol: c.symbol || '', exchangeRate: c.exchangeRate ?? 1, isBase: !!c.isBase });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) {
      return toast.error('Code, name, and symbol are required');
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        symbol: form.symbol.trim(),
        exchangeRate: parseFloat(form.exchangeRate) || 1,
        isBase: form.isBase,
      };
      if (editing) {
        await currencyAPI.update(editing._id, payload);
        toast.success('Currency updated');
      } else {
        await currencyAPI.create(payload);
        toast.success('Currency created');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save currency'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (c.isBase) return toast.error('Cannot delete base currency');
    if (!window.confirm(`Deactivate currency ${c.code}?`)) return;
    try {
      await currencyAPI.delete(c._id);
      toast.success('Currency deactivated');
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Currencies</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage currencies and their exchange rates</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Add Currency
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Exchange Rate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Base</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {currencies.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">No currencies found. Click "Add Currency" to create one.</td></tr>
              ) : currencies.map(c => (
                <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.code}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.symbol}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.exchangeRate}</td>
                  <td className="px-4 py-3">
                    {c.isBase ? <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full"><Star size={12} /> Base</span> : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${c.isActive !== false ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                      {c.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(c)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Coins size={18} /> {editing ? 'Edit Currency' : 'Add Currency'}</h3>
                <button onClick={() => { setShowModal(false); setEditing(null); setForm(emptyForm); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Code *</label>
                    <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={5} placeholder="USD" className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Symbol *</label>
                    <input value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="$" className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="US Dollar" className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Exchange Rate (relative to base)</label>
                  <input type="number" step="0.000001" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={form.isBase} onChange={e => setForm({ ...form, isBase: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600" />
                  Set as base currency
                </label>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                <button onClick={() => { setShowModal(false); setEditing(null); setForm(emptyForm); }} className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}{editing ? 'Update' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Currencies;
