import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { customerAPI, supplierAPI } from '../services/api';
import { formatCurrency } from '../utils/format';
import { useSettings } from '../hooks/useSettings';
import {
  Users, Truck, IndianRupee, AlertTriangle, Plus, UserPlus,
  MapPin, CreditCard, Save, CheckCircle,
  Search, Phone, Mail, Hash, Globe, MapPinned, Calendar,
  BookOpen, Tag, UserCircle
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const initialLetters = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};



const PARTY_ICONS = {
  Customer: Users,
  Supplier: Truck,
  Both: UserPlus,
};

const PartyDetails = () => {
  const { prefs } = useSettings();
  const customFieldDefs = Array.isArray(prefs.party?.customFieldDefs) && prefs.party.customFieldDefs.length > 0
    ? prefs.party.customFieldDefs
    : [];
  const partyGrouping = prefs.party?.partyGrouping ?? true;
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('all');
  const [form, setForm] = useState({
    name: '', partyType: 'Customer', mobile: '', email: '', gst: '',
    billingAddress: '', shippingAddress: '', state: '', pincode: '',
    openingBalance: '', creditLimit: '', dueDays: '30',
    notes: '',
    customFields: {},
  });

  const loadParties = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([customerAPI.getAll(), supplierAPI.getAll()]);
      setCustomers(cRes.data);
      setSuppliers(sRes.data);
    } catch {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadParties(); }, [loadParties]);

  const totalReceivable = customers.reduce((sum, c) => sum + (c.outstandingBalance || c.openingBalance || 0), 0);
  const totalPayable = suppliers.reduce((sum, s) => sum + (s.outstandingBalance || s.openingBalance || 0), 0);

  const allParties = [
    ...customers.map(c => ({ ...c, _partyType: 'Customer' })),
    ...suppliers.map(s => ({ ...s, _partyType: 'Supplier' })),
  ];

  const filteredParties = allParties.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.email?.toLowerCase().includes(q);
    const matchesFilter = partyFilter === 'all' || p._partyType === partyFilter;
    return matchesSearch && matchesFilter;
  });

  const hasParties = customers.length > 0 || suppliers.length > 0;

  const resetForm = () => {
    setForm({
      name: '', partyType: 'Customer', mobile: '', email: '', gst: '',
      billingAddress: '', shippingAddress: '', state: '', pincode: '',
      openingBalance: '', creditLimit: '', dueDays: '30',
      notes: '',
      customFields: {},
    });
    setEditingParty(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (party) => {
    setEditingParty(party);
    const cf = (party.customFields && typeof party.customFields === 'object' && !Array.isArray(party.customFields))
      ? party.customFields
      : {};
    setForm({
      name: party.name || '',
      partyType: party._partyType || 'Customer',
      mobile: party.phone || '',
      email: party.email || '',
      gst: party.gst || '',
      billingAddress: party.address || party.billingAddress || '',
      shippingAddress: party.shippingAddress || '',
      state: party.state || '',
      pincode: party.pincode || '',
      openingBalance: party.openingBalance || '',
      creditLimit: party.creditLimit || '',
      dueDays: party.dueDays || '30',
      notes: party.notes || '',
      customFields: cf,
    });
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Party name is required');
      return;
    }
    const payload = {
      name: form.name,
      phone: form.mobile,
      email: form.email,
      gstNumber: form.gst,
      address: form.billingAddress,
      shippingAddress: form.shippingAddress,
      state: form.state,
      pincode: form.pincode,
      openingBalance: parseFloat(form.openingBalance) || 0,
      creditLimit: parseFloat(form.creditLimit) || 0,
      dueDays: parseInt(form.dueDays) || 30,
      notes: form.notes,
      customFields: form.customFields || {},
    };
    try {
      if (editingParty) {
        const api = editingParty._partyType === 'Customer' ? customerAPI : supplierAPI;
        await api.update(editingParty._id, payload);
        toast.success('Party updated');
      } else {
        const api = form.partyType === 'Supplier' ? supplierAPI : customerAPI;
        await api.create(payload);
        toast.success('Party created');
        if (form.partyType === 'Both') {
          await customerAPI.create(payload);
        }
      }
      setShowModal(false);
      resetForm();
      loadParties();
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleSaveNew = async () => {
    if (!form.name.trim()) {
      toast.error('Party name is required');
      return;
    }
    const payload = {
      name: form.name, phone: form.mobile, email: form.email, gstNumber: form.gst,
      address: form.billingAddress, shippingAddress: form.shippingAddress,
      state: form.state, pincode: form.pincode,
      openingBalance: parseFloat(form.openingBalance) || 0,
      creditLimit: parseFloat(form.creditLimit) || 0,
      dueDays: parseInt(form.dueDays) || 30, notes: form.notes, customFields: form.customFields || {},
    };
    try {
      const api = form.partyType === 'Supplier' ? supplierAPI : customerAPI;
      await api.create(payload);
      toast.success('Party created');
      if (form.partyType === 'Both') {
        await customerAPI.create(payload);
      }
      resetForm();
      loadParties();
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (party) => {
    if (!window.confirm(`Delete ${party.name}?`)) return;
    try {
      const api = party._partyType === 'Customer' ? customerAPI : supplierAPI;
      await api.delete(party._id);
      toast.success('Party deleted');
      loadParties();
    } catch {
      toast.error('Delete failed');
    }
  };

  const StatsCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {[
        { label: 'Total Customers', value: customers.length, icon: Users, color: 'blue' },
        { label: 'Total Suppliers', value: suppliers.length, icon: Truck, color: 'amber' },
        { label: 'Outstanding Receivables', value: formatCurrency(totalReceivable), icon: IndianRupee, color: 'emerald' },
        { label: 'Outstanding Payables', value: formatCurrency(totalPayable), icon: AlertTriangle, color: 'red' },
      ].map((stat, idx) => (
        <motion.div key={idx} variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5 hover:shadow-card-hover transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-500/10`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600 dark:text-${stat.color}-400`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-lg lg:text-xl font-bold mt-0.5 text-slate-900 dark:text-slate-100 ${typeof stat.value === 'string' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {stat.value}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const EmptyIllustration = () => (
    <div className="flex flex-col items-center text-center py-12 lg:py-16">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: 'spring' }}
        className="relative mb-8"
      >
        <div className="w-40 h-40 lg:w-48 lg:h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 rounded-full flex items-center justify-center">
          <div className="w-32 h-32 lg:w-36 lg:h-36 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full flex items-center justify-center">
            <Users className="w-14 h-14 lg:w-16 lg:h-16 text-blue-400 dark:text-blue-500/50" />
          </div>
        </div>
        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
          <UserPlus className="w-6 h-6 text-emerald-500" />
        </div>
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2"
      >
        Manage Customers & Suppliers
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-sm lg:text-base text-slate-500 dark:text-slate-400 max-w-md mb-8"
      >
        Add customers and suppliers to track transactions, payments and business growth.
      </motion.p>
      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        onClick={openAddModal}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
      >
        <Plus className="w-4.5 h-4.5" /> Add Party
      </motion.button>
    </div>
  );

  const PartyListView = () => {
    const groupedParties = partyGrouping
      ? filteredParties.reduce((acc, p) => {
          const group = p.group || 'Ungrouped';
          if (!acc[group]) acc[group] = [];
          acc[group].push(p);
          return acc;
        }, {})
      : null;

    return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search parties by name, phone or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'Customer', 'Supplier'].map(f => (
            <button key={f} onClick={() => setPartyFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                partyFilter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
        {partyGrouping ? (
          Object.entries(groupedParties).map(([group, groupParties]) => (
            <div key={group} className="contents">
              <div className="col-span-full">
                <h3 className="px-4 py-2 bg-slate-100 dark:bg-gray-700 font-semibold text-slate-700 dark:text-slate-300 text-sm rounded-lg">{group}</h3>
              </div>
              {groupParties.map((party, idx) => {
                const Icon = PARTY_ICONS[party._partyType] || UserCircle;
                const typeColor = party._partyType === 'Customer' ? 'blue' : 'amber';
                const balance = party.outstandingBalance || party.openingBalance || 0;
                return (
                  <motion.div key={party._id} variants={itemVariants} layout
                    className="group bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5 hover:shadow-card-hover transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl bg-${typeColor}-50 dark:bg-${typeColor}-500/10 flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-sm font-bold text-${typeColor}-600 dark:text-${typeColor}-400`}>
                          {initialLetters(party.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{party.name}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                            party._partyType === 'Customer'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {party._partyType}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {party.phone && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Phone className="w-3 h-3" />{party.phone}</p>}
                          {party.email && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Mail className="w-3 h-3" />{party.email}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(party)}
                          className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                        >Edit</button>
                        <button onClick={() => handleDelete(party)}
                          className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        >Delete</button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Balance</span>
                        <span className={`text-sm font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(Math.abs(balance))}
                          {balance < 0 && ' (Due)'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        ) : (
          filteredParties.map((party, idx) => {
            const Icon = PARTY_ICONS[party._partyType] || UserCircle;
            const typeColor = party._partyType === 'Customer' ? 'blue' : 'amber';
            const balance = party.outstandingBalance || party.openingBalance || 0;
            return (
              <motion.div key={party._id} variants={itemVariants} layout
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5 hover:shadow-card-hover transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl bg-${typeColor}-50 dark:bg-${typeColor}-500/10 flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-sm font-bold text-${typeColor}-600 dark:text-${typeColor}-400`}>
                      {initialLetters(party.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{party.name}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                        party._partyType === 'Customer'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {party._partyType}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {party.phone && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Phone className="w-3 h-3" />{party.phone}</p>}
                      {party.email && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Mail className="w-3 h-3" />{party.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(party)}
                      className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                    >Edit</button>
                    <button onClick={() => handleDelete(party)}
                      className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >Delete</button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Balance</span>
                    <span className={`text-sm font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(Math.abs(balance))}
                      {balance < 0 && ' (Due)'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {filteredParties.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12">
          <div className="flex flex-col items-center text-center">
            <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No parties match your search</p>
          </div>
        </div>
      )}
    </motion.div>
    );
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Party Details</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your customers & suppliers</p>
        </div>
        {hasParties && (
          <button onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4.5 h-4.5" /> Add Party
          </button>
        )}
      </motion.div>

      <motion.div variants={itemVariants}><StatsCards /></motion.div>

      {hasParties ? <PartyListView /> : <EmptyIllustration />}

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
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-200/80 dark:border-gray-700"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingParty ? 'Edit Party' : 'Add New Party'}
                </h3>
                <button onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[55vh] space-y-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Party Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.name} onChange={e => handleInputChange('name', e.target.value)}
                      placeholder="Enter party name"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Party Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Customer', 'Supplier', 'Both'].map(type => (
                        <button key={type} type="button" onClick={() => handleInputChange('partyType', type)}
                          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                            form.partyType === type
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-gray-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-700 hover:border-blue-300'
                          }`}
                        >
                          {type === 'Customer' && <Users className="w-4 h-4" />}
                          {type === 'Supplier' && <Truck className="w-4 h-4" />}
                          {type === 'Both' && <UserPlus className="w-4 h-4" />}
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Mobile Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={form.mobile} onChange={e => handleInputChange('mobile', e.target.value)}
                          placeholder="Enter mobile number"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" value={form.email} onChange={e => handleInputChange('email', e.target.value)}
                          placeholder="Enter email address"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">GST Number</label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form.gst} onChange={e => handleInputChange('gst', e.target.value)}
                        placeholder="Enter GST number (e.g., 22AAAAA0000A1Z5)"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
                <hr className="border-slate-200 dark:border-gray-700" />
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Billing Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <textarea value={form.billingAddress} onChange={e => handleInputChange('billingAddress', e.target.value)}
                        placeholder="Enter billing address"
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Shipping Address</label>
                    <div className="relative">
                      <MapPinned className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <textarea value={form.shippingAddress} onChange={e => handleInputChange('shippingAddress', e.target.value)}
                        placeholder="Enter shipping address"
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">State</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={form.state} onChange={e => handleInputChange('state', e.target.value)}
                          placeholder="Enter state"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Pincode</label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={form.pincode} onChange={e => handleInputChange('pincode', e.target.value)}
                          placeholder="Enter pincode"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <hr className="border-slate-200 dark:border-gray-700" />
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Opening Balance</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="number" value={form.openingBalance} onChange={e => handleInputChange('openingBalance', e.target.value)}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">Positive = receivable, Negative = payable</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Credit Limit</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="number" value={form.creditLimit} onChange={e => handleInputChange('creditLimit', e.target.value)}
                          placeholder="0"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Due Days</label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="number" value={form.dueDays} onChange={e => handleInputChange('dueDays', e.target.value)}
                          placeholder="30"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <hr className="border-slate-200 dark:border-gray-700" />
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Notes</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <textarea value={form.notes} onChange={e => handleInputChange('notes', e.target.value)}
                        placeholder="Add any notes about this party..."
                        rows={4}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                  {customFieldDefs.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> Custom Fields
                      </label>
                      <div className="space-y-3">
                        {customFieldDefs.map(field => (
                          <div key={field.id}>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{field.name}{field.showInPrint && <span className="ml-1 text-[10px] uppercase tracking-wider text-blue-500">(shown in print)</span>}</label>
                            <input type="text" value={form.customFields?.[field.name] || ''}
                              onChange={e => setForm(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [field.name]: e.target.value } }))}
                              placeholder={`Enter ${field.name.toLowerCase()}`}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                {!editingParty && (
                  <button onClick={handleSaveNew}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    <Save className="w-4 h-4" /> Save & New
                  </button>
                )}
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PartyDetails;
