import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import EmptyState from '../components/CashBank/EmptyState';
import { chequeAPI } from '../services/api';

const emptyForm = { date: new Date().toISOString().split('T')[0], chequeNo: '', bankName: '', customerName: '', amount: '', status: 'pending' };

const Cheques = () => {
  const [openMenu, setOpenMenu] = useState(false);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await chequeAPI.getAll();
      setCheques(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c) => { setEditId(c._id); setForm({ date: c.date ? new Date(c.date).toISOString().split('T')[0] : '', chequeNo: c.chequeNo || '', bankName: c.bankName || '', customerName: c.customerName || c.partyName || '', amount: c.amount || '', status: c.status || 'pending' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.chequeNo) return toast.error('Cheque number is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter valid amount');
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), mode: 'cheque' };
      if (editId) { await chequeAPI.update(editId, payload); toast.success('Cheque updated'); }
      else { await chequeAPI.create(payload); toast.success('Cheque added'); }
      setShowModal(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cheque?')) return;
    try { await chequeAPI.delete(id); toast.success('Cheque deleted'); loadData(); }
    catch { toast.error('Failed to delete'); }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Cheque No.', 'Bank Name', 'Customer', 'Amount', 'Status'];
    const rows = cheques.map(c => [c.date ? new Date(c.date).toLocaleDateString('en-IN') : '-', c.chequeNo || '-', c.bankName || '-', c.customerName || c.partyName || '-', c.amount || 0, c.status || '-']);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cheques.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
    setOpenMenu(false);
  };

  if (!loading && cheques.length === 0 && !showModal) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Cheque Details</h1>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Cheque</button>
        </div>
        <EmptyState
          icon={<svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="20" width="70" height="50" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="35" x2="75" y2="35" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="42" x2="75" y2="42" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="49" x2="60" y2="49" stroke="#D1D5DB" strokeWidth="1" /></svg>}
          title="No Cheques to Show"
          subtitle="You haven't added any Cheque transactions yet."
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Cheque Details</h1>
          <div className="flex items-center gap-2">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Cheque</button>
            <div className="relative">
              <button onClick={() => setOpenMenu(!openMenu)} className="p-2 rounded-md hover:bg-gray-200 transition-colors"><MoreHorizontal className="w-5 h-5 text-gray-600" /></button>
              {openMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                    <button onClick={exportCSV} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export as CSV</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cheque No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bank Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c, i) => (
                <tr key={c._id || i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{c.date ? new Date(c.date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.chequeNo || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.bankName || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.customerName || c.partyName || '-'}</td>
                  <td className="px-4 py-3 text-gray-900 text-right font-medium">₹{(c.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'cleared' ? 'bg-green-100 text-green-700' : c.status === 'bounced' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(c)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(c._id)} className="p-1 hover:bg-gray-100 rounded ml-1"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editId ? 'Edit Cheque' : 'Add Cheque'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cheque No.</label>
                <input type="text" value={form.chequeNo} onChange={e => setForm({...form, chequeNo: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter cheque number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                <input type="text" value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter bank name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer / Party</label>
                <input type="text" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Enter customer name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0.00" min="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="pending">Pending</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Cheques;
