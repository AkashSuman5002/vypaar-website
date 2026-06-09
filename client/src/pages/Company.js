import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, CheckCircle, Edit3, Trash2, ArrowLeft, Phone, Mail, MapPin, Loader2, X, Globe, ExternalLink } from 'lucide-react';
import { businessAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
];

const emptyForm = { companyName: '', email: '', phone: '', address: '', gstNumber: '', state: '', panNumber: '', businessType: 'retail', businessCategory: '', pincode: '' };

const Company = () => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadBusinesses = async () => {
    try {
      const res = await businessAPI.getAll();
      setBusinesses(res.data);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBusinesses(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (biz) => {
    setEditItem(biz);
    setForm({
      companyName: biz.name || '',
      email: biz.email || '',
      phone: biz.phone || '',
      address: biz.address || '',
      gstNumber: biz.gstNumber || '',
      state: biz.state || '',
      panNumber: biz.panNumber || '',
      businessType: biz.businessType || 'retail',
      businessCategory: biz.businessCategory || '',
      pincode: biz.pincode || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim()) { toast.error('Company name is required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, name: form.companyName };
      if (editItem) {
        await businessAPI.update(editItem._id, payload);
        toast.success('Company updated');
      } else {
        await businessAPI.create(payload);
        toast.success('Company created');
      }
      setShowForm(false);
      loadBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitch = async (biz) => {
    try {
      await businessAPI.switch(biz._id);
      localStorage.setItem('activeBusiness', biz._id);
      window.dispatchEvent(new Event('business-switched'));
      toast.success(`Switched to ${biz.name}`);
      loadBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch');
    }
  };

  const handleOpen = async (biz) => {
    if (!biz.isActive) {
      try {
        await businessAPI.switch(biz._id);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to open');
        return;
      }
    }
    localStorage.setItem('activeBusiness', biz._id);
    window.dispatchEvent(new Event('business-switched'));
    toast.success(`Opened ${biz.name}`);
    loadBusinesses();
    navigate('/');
  };

  const handleDelete = async (biz) => {
    if (!window.confirm(`Delete "${biz.name}"? This cannot be undone.`)) return;
    try {
      await businessAPI.delete(biz._id);
      toast.success('Company deleted');
      loadBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading companies...</span>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">My Companies</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{businesses.length} company(ies)</p>
          </div>
        </div>
        <button onClick={openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Company List */}
      <div className="space-y-3">
        {businesses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No Companies Yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add your first company to get started</p>
            <button onClick={openAddForm} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4 inline mr-1" /> Add Company
            </button>
          </div>
        ) : (
          businesses.map((biz) => (
            <motion.div key={biz._id} layout
              className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-soft p-5 transition-all ${
                biz.isActive
                  ? 'border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/30'
                  : 'border-slate-200/80 dark:border-gray-700/80 hover:border-slate-300 dark:hover:border-gray-600'
              }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  biz.isActive ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-gray-700'
                }`}>
                  <Building2 className={`w-6 h-6 ${biz.isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{biz.name}</h3>
                    {biz.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-md">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {biz.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{biz.phone}</span>}
                    {biz.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{biz.email}</span>}
                    {biz.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{biz.state}</span>}
                    {biz.gstNumber && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />GST: {biz.gstNumber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {biz.isActive ? (
                    <button onClick={() => handleOpen(biz)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      <ExternalLink className="w-3 h-3" /> Open
                    </button>
                  ) : (
                    <button onClick={() => handleOpen(biz)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                      Open
                    </button>
                  )}
                  <button onClick={() => openEditForm(biz)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                  {!biz.isActive && (
                    <button onClick={() => handleDelete(biz)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editItem ? 'Edit Company' : 'Add New Company'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company Name <span className="text-red-500">*</span></label>
                  <input type="text" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Enter company name" required
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+91-XXXXXXXXXX"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="company@email.com"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">GSTIN</label>
                    <input type="text" name="gstNumber" value={form.gstNumber} onChange={handleChange} placeholder="GSTIN Number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">PAN</label>
                    <input type="text" name="panNumber" value={form.panNumber} onChange={handleChange} placeholder="PAN Number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Business Type</label>
                    <select name="businessType" value={form.businessType} onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                      {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pincode</label>
                    <input type="text" name="pincode" value={form.pincode} onChange={handleChange} placeholder="Pincode"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">State</label>
                  <select name="state" value={form.state} onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Address</label>
                  <textarea name="address" value={form.address} onChange={handleChange} rows={3} placeholder="Business address"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-600 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Company;
