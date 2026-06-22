import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { Layers, Plus, Pencil, Trash2, X, Users, Search, Filter } from 'lucide-react';
import { partyGroupAPI } from '../services/api';
import { formatCurrency } from '../utils/format';

const TYPES = [
  { value: 'all', label: 'All Groups' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'both', label: 'Both' },
];

const EMPTY_FORM = { name: '', type: 'both', description: '', color: '#3B82F6' };

const PartyGroups = () => {
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { type: filter } : {};
      const [groupsRes, summaryRes] = await Promise.all([
        partyGroupAPI.getAll(params),
        partyGroupAPI.getSummary(),
      ]);
      setGroups(groupsRes.data);
      setSummary(summaryRes.data);
    } catch {
      toast.error('Failed to load party groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const getSummaryFor = (id) => summary.find(s => s._id === id) || {};

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalGroups = groups.length;
  const totalCustomers = summary.reduce((s, g) => s + g.customerCount, 0);
  const totalSuppliers = summary.reduce((s, g) => s + g.supplierCount, 0);

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (g) => { setForm({ name: g.name, type: g.type, description: g.description || '', color: g.color || '#3B82F6' }); setEditId(g._id); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Group name is required');
    try {
      setSaving(true);
      if (editId) {
        await partyGroupAPI.update(editId, form);
        toast.success('Group updated');
      } else {
        await partyGroupAPI.create(form);
        toast.success('Group created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await partyGroupAPI.delete(id);
      toast.success('Group deleted');
      setDeleteConfirm(null);
      load();
    } catch {
      toast.error('Failed to delete group');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Party Groups</h1>
          <p className="text-sm text-slate-500 mt-1">Organize your customers and suppliers into groups</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
          <Plus size={18} /> Add Group
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Layers size={20} className="text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{totalGroups}</p><p className="text-xs text-slate-500">Total Groups</p></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Users size={20} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{totalCustomers}</p><p className="text-xs text-slate-500">Customers in Groups</p></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Users size={20} className="text-violet-600" /></div>
            <div><p className="text-2xl font-bold text-slate-800">{totalSuppliers}</p><p className="text-xs text-slate-500">Suppliers in Groups</p></div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            {TYPES.map(t => (
              <button key={t.value} onClick={() => setFilter(t.value)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === t.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t.label}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Layers size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No party groups found</p>
            <p className="text-sm text-slate-400 mt-1">Create your first group to organize parties</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Color</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customers</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Suppliers</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(g => {
                  const s = getSummaryFor(g._id);
                  return (
                    <tr key={g._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{g.name}</p>
                            {g.description && <p className="text-xs text-slate-400 mt-0.5">{g.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${g.type === 'customer' ? 'bg-blue-50 text-blue-700' : g.type === 'supplier' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                          {g.type === 'both' ? 'Customer & Supplier' : g.type.charAt(0).toUpperCase() + g.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4"><div className="w-5 h-5 rounded-md border border-slate-200" style={{ backgroundColor: g.color }} /></td>
                      <td className="px-5 py-4 text-center text-sm font-medium text-slate-700">{s.customerCount || 0}</td>
                      <td className="px-5 py-4 text-center text-sm font-medium text-slate-700">{s.supplierCount || 0}</td>
                      <td className="px-5 py-4 text-center text-sm font-medium text-emerald-600">{formatCurrency(s.totalSales || 0)}</td>
                      <td className="px-5 py-4 text-center text-sm font-medium text-blue-600">{formatCurrency(s.totalPurchases || 0)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {g.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(g)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteConfirm(g)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Group' : 'Add Party Group'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Group Name <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter group name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="both">Customer & Supplier</option>
                    <option value="customer">Customer Only</option>
                    <option value="supplier">Supplier Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                    <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Group</h3>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete <span className="font-medium text-slate-700">{deleteConfirm.name}</span>? Parties in this group will be unassigned.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm._id)} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PartyGroups;
