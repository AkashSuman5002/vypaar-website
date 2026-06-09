import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { customerAPI, supplierAPI } from '../services/api';
import {
  Plus, Search, Trash2, X, ChevronLeft, ChevronRight, ArrowRightLeft,
  Save, Loader2, ArrowRight, Users, Building2, IndianRupee,
} from 'lucide-react';
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api', withCredentials: true });
API.interceptors.request.use((req) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.token) req.headers.Authorization = `Bearer ${user.token}`;
  return req;
});

const transferAPI = {
  getAll: (params) => API.get('/party-transfers', { params }),
  getById: (id) => API.get(`/party-transfers/${id}`),
  create: (data) => API.post('/party-transfers', data),
  delete: (id) => API.delete(`/party-transfers/${id}`),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const PartyToPartyTransfer = () => {
  const [transfers, setTransfers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const [form, setForm] = useState({
    fromPartyType: 'customer', fromParty: '', fromPartyName: '',
    toPartyType: 'customer', toParty: '', toPartyName: '',
    amount: '', date: new Date().toISOString().split('T')[0], notes: '',
  });

  const fetchTransfers = async (page = 1) => {
    try {
      const params = searchQuery
        ? { page: 1, limit: 10000 }
        : { page, limit: pageSize };
      const { data } = await transferAPI.getAll(params);
      setTransfers(data.transfers);
      setTotalPages(data.pages);
    } catch (err) {
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransfers(currentPage); }, [currentPage, searchQuery]);

  useEffect(() => {
    Promise.all([
      customerAPI.getAll().catch(() => []),
      supplierAPI.getAll().catch(() => []),
    ]).then(([c, s]) => {
      setCustomers(c.data || []);
      setSuppliers(s.data || []);
    });
  }, []);

  const getPartyList = (type) => type === 'customer' ? customers : suppliers;

  const handlePartyChange = (side, value) => {
    const [id, name, type] = value.split('|');
    setForm(prev => ({ ...prev, [`${side}Party`]: id, [`${side}PartyName`]: name, [`${side}PartyType`]: type }));
  };

  const resetForm = () => {
    setForm({
      fromPartyType: 'customer', fromParty: '', fromPartyName: '',
      toPartyType: 'customer', toParty: '', toPartyName: '',
      amount: '', date: new Date().toISOString().split('T')[0], notes: '',
    });
  };

  const handleSave = async () => {
    if (!form.fromParty || !form.toParty) { toast.error('Select both parties'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.fromParty === form.toParty) { toast.error('From and To parties cannot be the same'); return; }
    try {
      await transferAPI.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Transfer completed');
      setShowModal(false);
      resetForm();
      fetchTransfers(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transfer?')) return;
    try {
      await transferAPI.delete(id);
      toast.success('Transfer deleted');
      fetchTransfers(currentPage);
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const totalAmount = transfers.reduce((s, t) => s + t.amount, 0);
  const displayEntries = searchQuery
    ? transfers.filter(t => {
        const q = searchQuery.toLowerCase();
        return !q || t.fromPartyName?.toLowerCase().includes(q) || t.toPartyName?.toLowerCase().includes(q);
      })
    : transfers;
  const paginated = displayEntries.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Party to Party Transfer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Transfer balances between customers and suppliers</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        ><Plus className="w-4.5 h-4.5" /> New Transfer</button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl"><ArrowRightLeft className="w-5 h-5 text-indigo-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transfers</p><p className="text-xl font-bold text-slate-900 mt-1">{transfers.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transferred</p><p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalAmount)}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by party name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </motion.div>

      {transfers.length === 0 ? (
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full flex items-center justify-center mb-6">
              <ArrowRightLeft className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Transfers Yet</h2>
            <p className="text-sm text-slate-500 mb-6">Transfer balances between customers and suppliers.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4.5 h-4.5" /> New Transfer</button>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Date', 'From', 'To', 'Amount', 'Notes', ''].map(h => (
                      <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t, idx) => (
                    <tr key={t._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-red-50"><Users className="w-3.5 h-3.5 text-red-500" /></div>
                          <span className="text-sm font-medium text-slate-900">{t.fromPartyName}</span>
                          <span className="text-2xs text-slate-400 uppercase">({t.fromPartyType})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-emerald-50"><Building2 className="w-3.5 h-3.5 text-emerald-500" /></div>
                          <span className="text-sm font-medium text-slate-900">{t.toPartyName}</span>
                          <span className="text-2xs text-slate-400 uppercase">({t.toPartyType})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900">{formatCurrency(t.amount)}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500">{t.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(t._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{displayEntries.length} transfers</p>
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
        </>
      )}

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
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] overflow-hidden border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Party to Party Transfer</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-red-500" /> From Party</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Type</label>
                      <select value={form.fromPartyType} onChange={e => setForm({ ...form, fromPartyType: e.target.value, fromParty: '', fromPartyName: '' })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                      >
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Party</label>
                      <select value={form.fromParty ? `${form.fromParty}|${form.fromPartyName}|${form.fromPartyType}` : ''}
                        onChange={e => handlePartyChange('from', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                      >
                        <option value="">Select</option>
                        {getPartyList(form.fromPartyType).map(p => (
                          <option key={p._id} value={`${p._id}|${p.name}|${form.fromPartyType}`}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-slate-300" />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-emerald-500" /> To Party</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Type</label>
                      <select value={form.toPartyType} onChange={e => setForm({ ...form, toPartyType: e.target.value, toParty: '', toPartyName: '' })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                      >
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Party</label>
                      <select value={form.toParty ? `${form.toParty}|${form.toPartyName}|${form.toPartyType}` : ''}
                        onChange={e => handlePartyChange('to', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                      >
                        <option value="">Select</option>
                        {getPartyList(form.toPartyType).map(p => (
                          <option key={p._id} value={`${p._id}|${p.name}|${form.toPartyType}`}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Amount (₹)</label>
                    <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00" min="0" step="0.01"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={2} placeholder="Optional notes..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm"
                ><Save className="w-4 h-4" /> Transfer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PartyToPartyTransfer;
