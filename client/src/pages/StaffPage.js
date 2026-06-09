import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, DollarSign, Download, Plus, Eye, Search, Filter,
  Calendar, X, Loader2, Pencil, Trash2, Phone, Mail,
} from 'lucide-react';
import { staffAPI, saleAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const ROLES = ['salesman', 'manager', 'accountant', 'admin'];

const StaffPage = () => {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [staffSales, setStaffSales] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'salesman', commissionRate: 0, notes: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (searchQuery) params.search = searchQuery;
      if (roleFilter) params.role = roleFilter;
      const { data } = await staffAPI.getAll(params);
      setStaffList(data.staff || []);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const resetForm = () => {
    setForm({ name: '', phone: '', email: '', role: 'salesman', commissionRate: 0, notes: '' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      if (editing) {
        await staffAPI.update(editing._id, form);
        toast.success('Staff updated');
      } else {
        await staffAPI.create(form);
        toast.success('Staff added');
      }
      setShowModal(false);
      resetForm();
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save staff');
    }
  };

  const handleEdit = (staff) => {
    setForm({ name: staff.name, phone: staff.phone || '', email: staff.email || '', role: staff.role, commissionRate: staff.commissionRate || 0, notes: staff.notes || '' });
    setEditing(staff);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this staff member?')) return;
    try {
      await staffAPI.delete(id);
      toast.success('Staff removed');
      loadStaff();
    } catch {
      toast.error('Failed to remove staff');
    }
  };

  const handleViewDetail = async (staff) => {
    setSelectedStaff(staff);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data: stats } = await staffAPI.getStats(staff._id, params);
      const saleParams = { limit: 200, salesman: staff.name };
      if (dateFrom) saleParams.dateFrom = dateFrom;
      if (dateTo) saleParams.dateTo = dateTo;
      const { data: salesData } = await saleAPI.getAll(saleParams);
      setStaffSales(salesData.sales || []);
    } catch {
      toast.error('Failed to load staff details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = () => {
    const header = 'Name,Role,Phone,Email,Commission Rate\n';
    const rows = staffList.map(s => `${s.name},${s.role},${s.phone || ''},${s.email || ''},${s.commissionRate || 0}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'staff.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported staff data');
  };

  const totalSalesAmount = staffSales.reduce((s, sale) => s + (sale.total || 0), 0);
  const totalPending = staffSales.reduce((s, sale) => s + (sale.balanceDue || 0), 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Staff</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your sales team and track performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Staff</button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><Users className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Staff</p><p className="text-xl font-bold text-slate-900 mt-1">{staffList.length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</p><p className="text-xl font-bold text-slate-900 mt-1">{staffList.filter(s => s.isActive).length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 rounded-xl"><DollarSign className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Roles</p><p className="text-xl font-bold text-slate-900 mt-1">{new Set(staffList.map(s => s.role)).size}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </motion.div>

      {loading ? (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 flex items-center justify-center"
        ><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></motion.div>
      ) : staffList.length === 0 ? (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 rounded-full flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Add your first staff member</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Track sales performance and assign staff to invoices.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4.5 h-4.5" /> Add Staff</button>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Commission</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s._id} className="border-b border-slate-100 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {s.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                        s.role === 'salesman' ? 'bg-blue-50 text-blue-700' :
                        s.role === 'manager' ? 'bg-purple-50 text-purple-700' :
                        s.role === 'accountant' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{s.role}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.commissionRate ? `${s.commissionRate}%` : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewDetail(s)} title="View Details"
                          className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        ><Eye className="w-4 h-4 text-blue-600" /></button>
                        <button onClick={() => handleEdit(s)} title="Edit"
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        ><Pencil className="w-4 h-4 text-slate-500" /></button>
                        <button onClick={() => handleDelete(s._id)} title="Delete"
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        ><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editing ? 'Edit Staff' : 'Add Staff'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Enter name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                    <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Commission %</label>
                    <input type="number" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      min="0" max="100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={2} placeholder="Any notes..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-gray-700">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >Cancel</button>
                <button onClick={handleSave}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all"
                >{editing ? 'Update' : 'Add'} Staff</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetail && selectedStaff && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowDetail(false); setStaffSales([]); }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {selectedStaff.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedStaff.name}</h3>
                    <p className="text-xs text-slate-500">{selectedStaff.role} {selectedStaff.phone && <span className="ml-2"><Phone className="w-3 h-3 inline" /> {selectedStaff.phone}</span>}</p>
                  </div>
                </div>
                <button onClick={() => { setShowDetail(false); setStaffSales([]); }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg"
                ><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="p-4">
                <div className="flex gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <button onClick={() => handleViewDetail(selectedStaff)}
                    className="self-end px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all"
                  >Apply</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-medium text-blue-600">Sales Count</p>
                    <p className="text-xl font-bold text-blue-700 mt-1">{staffSales.length}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-medium text-emerald-600">Total Amount</p>
                    <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(totalSalesAmount)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-medium text-red-600">Pending Dues</p>
                    <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(totalPending)}</p>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[40vh]">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                  ) : staffSales.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No sales found for this staff member.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Invoice</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Customer</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Date</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffSales.map(sale => (
                          <tr key={sale._id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm font-medium text-slate-900">{sale.invoiceNumber || '-'}</td>
                            <td className="px-3 py-2 text-sm text-slate-600">{sale.customerName || 'Walk-in'}</td>
                            <td className="px-3 py-2 text-sm text-slate-600">{formatDate(sale.date)}</td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-900 text-right">{formatCurrency(sale.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StaffPage;
