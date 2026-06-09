import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Camera, Upload, Building2, ArrowLeft, Save } from 'lucide-react';
import { businessAPI, settingAPI } from '../services/api';
import useSettings from '../hooks/useSettings';

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

const BUSINESS_CATEGORIES = [
  'Mobile & Accessories', 'Electronics', 'Grocery', 'Clothing & Fashion',
  'Footwear', 'Kitchen & Home', 'Beauty & Health', 'Sports & Fitness',
  'Automobile', 'Pharmacy', 'Stationery', 'Jewellery',
  'Furniture', 'Hardware & Paints', 'Agriculture', 'Other',
];

const EditProfile = () => {
  const navigate = useNavigate();
  const { settings, reload } = useSettings();
  const logoInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);

  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: '',
    state: '',
    businessType: 'retail',
    businessCategory: '',
    pincode: '',
    accountBooksBeginningDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        businessName: settings.businessName || '',
        phone: settings.phone || '',
        email: settings.email || '',
        gstNumber: settings.gstNumber || '',
        address: settings.address || '',
        state: settings.state || '',
        businessType: settings.businessType || 'retail',
        businessCategory: settings.businessCategory || '',
        pincode: settings.pincode || '',
        accountBooksBeginningDate: settings.accountBooksBeginningDate
          ? new Date(settings.accountBooksBeginningDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      });
      if (settings.logo) setLogoPreview(settings.logo);
      if (settings.signature) setSignaturePreview(settings.signature);
    }
  }, [settings]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setSignaturePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined) fd.append(key, value);
      });
      if (logoFile) fd.append('logo', logoFile);
      if (signatureFile) fd.append('signature', signatureFile);

      await businessAPI.updateProfile(fd);
      await reload();
      toast.success('Profile updated successfully');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, field, type = 'text', placeholder, required }) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={form[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      />
    </div>
  );

  const SelectField = ({ label, field, options, placeholder }) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={form[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        <option value="">{placeholder || 'Select'}</option>
        {options.map(opt => (
          <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Profile</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Logo Section */}
        <div className="mb-8">
          <div className="relative w-32 h-32">
            <div
              onClick={() => logoInputRef.current?.click()}
              className="w-32 h-32 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Building2 className="w-10 h-10 text-blue-400 mb-1" />
                  <span className="text-xs font-medium text-blue-500">Add Logo</span>
                </>
              )}
            </div>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Business Details */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Business Details</h2>
            <div className="space-y-4">
              <InputField label="Business Name" field="businessName" placeholder="Enter business name" required />
              <InputField label="Phone Number" field="phone" type="tel" placeholder="Enter phone number" />
              <InputField label="GSTIN" field="gstNumber" placeholder="Enter GSTIN" />
              <InputField label="Email ID" field="email" type="email" placeholder="Enter Email ID" />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Account Books Beginning Date</label>
                <input
                  type="date"
                  value={form.accountBooksBeginningDate || ''}
                  onChange={(e) => handleChange('accountBooksBeginningDate', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* More Details */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">More Details</h2>
            <div className="space-y-4">
              <SelectField label="Business Type" field="businessType" options={BUSINESS_TYPES} placeholder="Select Business Type" />
              <SelectField label="Business Category" field="businessCategory" options={BUSINESS_CATEGORIES} placeholder="Select Business Category" />
              <SelectField label="State" field="state" options={INDIAN_STATES} placeholder="Select State" />
              <InputField label="Pincode" field="pincode" placeholder="Enter Pincode" />
            </div>
          </div>

          {/* Address & Signature */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Business Address</h2>
            <div className="space-y-4">
              <div>
                <textarea
                  value={form.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter Business Address"
                  rows={5}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Add Signature</label>
                <div
                  onClick={() => signatureInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-slate-200 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors bg-slate-50 dark:bg-gray-800/50 overflow-hidden"
                >
                  {signaturePreview ? (
                    <img src={signaturePreview} alt="Signature" className="max-h-full object-contain" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Upload Signature</span>
                    </>
                  )}
                </div>
                <input ref={signatureInputRef} type="file" accept="image/*" onChange={handleSignatureChange} className="hidden" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EditProfile;
