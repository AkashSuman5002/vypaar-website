import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Building2, ArrowRight, FileText, Save } from 'lucide-react';
import { businessAPI, settingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const BUSINESS_CATEGORIES = [
  'Mobile & Accessories', 'Electronics & Appliances', 'Groceries & FMCG',
  'Fashion & Apparel', 'Food & Beverages', 'Health & Pharmaceuticals',
  'Home & Furniture', 'Stationery & Office Supplies', 'Automobile & Parts',
  'Beauty & Personal Care', 'Sports & Entertainment', 'Industrial & Tools',
  'Agriculture & Farming', 'Construction & Building Materials', 'Services', 'Other',
];

const SetupMyBusiness = () => {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [form, setForm] = useState({
    businessName: '', phone: '', category: 'Mobile & Accessories',
    gstNumber: '', address: '', state: '', email: '', ownerName: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await settingAPI.get();
        const biz = data.business || data;
        setForm(prev => ({
          ...prev,
          businessName: biz.name || user?.businessName || '',
          phone: biz.phone || user?.phone || '',
          email: biz.email || user?.email || '',
          ownerName: biz.ownerName || user?.name || '',
          gstNumber: biz.gstNumber || '',
          address: biz.address || '',
          state: biz.state || '',
          category: biz.category || 'Mobile & Accessories',
        }));
        if (biz.logo) setLogoPreview(biz.logo.startsWith('http') ? biz.logo : `http://localhost:5000${biz.logo}`);
      } catch {
        if (user) {
          setForm(prev => ({ ...prev, ownerName: user.name || '', email: user.email || '', phone: user.phone || '' }));
        }
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.businessName || !form.phone) { toast.error('Please fill in required fields'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', form.businessName);
      fd.append('phone', form.phone);
      fd.append('email', form.email);
      fd.append('ownerName', form.ownerName);
      fd.append('gstNumber', form.gstNumber);
      fd.append('address', form.address);
      fd.append('state', form.state);
      fd.append('category', form.category);
      if (fileRef.current?.files[0]) fd.append('logo', fileRef.current.files[0]);
      await businessAPI.updateProfile(fd);
      toast.success('Business details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Set Up My Business</h1>
        <p className="text-sm text-slate-400 mt-0.5">Enter your business details to configure your invoice format and settings.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h2 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" /> Enter Business Details
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 cursor-pointer" onClick={() => fileRef.current?.click()}>
                {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-slate-400" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Company Logo</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 hover:underline">Upload Logo</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <input type="text" value={form.businessName} onChange={handleChange('businessName')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Company Name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                <input type="tel" value={form.phone} onChange={handleChange('phone')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Phone Number" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                <input type="text" value={form.ownerName} onChange={handleChange('ownerName')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Owner Name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={handleChange('email')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Email" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Category *</label>
              <select value={form.category} onChange={handleChange('category')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
              <input type="text" value={form.gstNumber} onChange={handleChange('gstNumber')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="GST Number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea value={form.address} onChange={handleChange('address')} rows={2} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm resize-none" placeholder="Business Address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input type="text" value={form.state} onChange={handleChange('state')} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="State" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Sample Tax Invoice
          </h2>
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 text-xs">
            <div className="text-center mb-3">
              {logoPreview && <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg mx-auto mb-2 object-cover" />}
              <h3 className="text-base font-bold text-slate-900">{form.businessName || 'Your Company'}</h3>
              <p className="text-slate-500">Phone: {form.phone || 'XXXXX XXXXX'}</p>
              {form.gstNumber && <p className="text-slate-500">GSTIN: {form.gstNumber}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><p className="font-semibold text-slate-700">Bill To:</p><p className="text-slate-500">Sample Party</p></div>
              <div className="text-right"><p className="font-semibold text-slate-700">Invoice:</p><p className="text-slate-500">No: 001 | {new Date().toLocaleDateString('en-IN')}</p></div>
            </div>
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-200"><th className="p-1.5 text-left">#</th><th className="p-1.5 text-left">Item</th><th className="p-1.5 text-right">Qty</th><th className="p-1.5 text-right">Amount</th></tr></thead>
              <tbody><tr className="border-b"><td className="p-1.5">1</td><td className="p-1.5">Sample Item</td><td className="p-1.5 text-right">1</td><td className="p-1.5 text-right">₹400.00</td></tr></tbody>
            </table>
            <div className="text-right mt-2 font-semibold text-slate-700">Total: ₹400.00</div>
            <div className="mt-3 pt-3 border-t text-slate-500">Thanks for doing business with us!</div>
            <div className="mt-4 text-right text-slate-500">For {form.businessName || 'My Company'}:<div className="mt-6 border-t border-slate-300 w-24 ml-auto pt-1">Authorized Signatory</div></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SetupMyBusiness;
