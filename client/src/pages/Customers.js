import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customerAPI } from '../services/api';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/format';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Plus, Eye, Users, IndianRupee, UserPlus } from 'lucide-react';

const initialLetters = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', openingBalance: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const { data } = await customerAPI.getAll();
      setCustomers(data);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, openingBalance: parseFloat(form.openingBalance) || 0 };
    try {
      if (edit) {
        await customerAPI.update(edit._id, payload);
        toast.success('Customer updated');
      } else {
        await customerAPI.create(payload);
        toast.success('Customer created');
      }
      setModal(false);
      setEdit(null);
      setForm({ name: '', phone: '', email: '', address: '', openingBalance: '' });
      loadCustomers();
    } catch { toast.error('Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await customerAPI.delete(id);
      toast.success('Customer deleted');
      loadCustomers();
    } catch { toast.error('Delete failed'); }
  };

  const openEdit = (customer) => {
    setEdit(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      openingBalance: customer.openingBalance || '',
    });
    setModal(true);
  };

  const totalReceivable = customers.reduce((s, c) => s + (parseFloat(c.openingBalance) || 0), 0);
  const newThisMonth = customers.filter((c) => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const columns = [
    {
      key: 'name', label: 'Customer',
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
            {initialLetters(v)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{v}</p>
            {row.email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.email}</p>}
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-slate-600 dark:text-slate-400">{v}</span> },
    { key: 'openingBalance', label: 'Opening Balance', render: (v) => <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(v)}</span> },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-0.5">
          <Link to={`/customers/${row._id}/ledger`} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Ledger">
            <Eye className="w-4 h-4" />
          </Link>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your customer base</p>
        </div>
        <button onClick={() => { setEdit(null); setForm({ name: '', phone: '', email: '', address: '', openingBalance: '' }); setModal(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Customers</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{customers.length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"><IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Receivable</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(totalReceivable)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl"><UserPlus className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">New This Month</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{newThisMonth}</p></div>
          </div>
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState type="customers" actionLabel="Add Customer" onAction={() => { setEdit(null); setForm({ name: '', phone: '', email: '', address: '', openingBalance: '' }); setModal(true); }} />
      ) : (
        <DataTable columns={columns} data={customers} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Customer Name</label>
            <input placeholder="Enter customer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Phone</label>
              <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
              <input placeholder="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Address</label>
            <textarea placeholder="Enter address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Opening Balance</label>
            <input placeholder="0.00" type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">{edit ? 'Update Customer' : 'Create Customer'}</button>
        </form>
      </Modal>
    </motion.div>
  );
};

export default Customers;
