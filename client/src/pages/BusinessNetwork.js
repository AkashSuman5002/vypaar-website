import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { customerAPI, supplierAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { toast } from 'react-toastify';
import {
  Search, Users, FileText, Download, Filter, X, Clock, CheckCircle, AlertTriangle,
  IndianRupee, Phone, Mail, UserCircle, RefreshCw, Loader2, Building2, Info,
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

const BusinessNetwork = () => {
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadParties = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([customerAPI.getAll(), supplierAPI.getAll()]);
      setCustomers(cRes.data);
      setSuppliers(sRes.data);
    } catch {
      toast.error('Failed to load network');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadParties(); }, [loadParties]);

  const allParties = [
    ...customers.map(c => ({ ...c, _partyType: 'Customer' })),
    ...suppliers.map(s => ({ ...s, _partyType: 'Supplier' })),
  ];

  const filteredParties = allParties.filter(p => {
    const q = searchQuery.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q);
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading network...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Business Network</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">View and manage your business parties</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search parties..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700/60 max-h-[600px] overflow-y-auto scrollbar-thin">
              {filteredParties.length > 0 ? (
                filteredParties.map(party => {
                  const isSelected = selectedParty?._id === party._id;
                  const balance = party.outstandingBalance || party.openingBalance || 0;
                  return (
                    <motion.button key={party._id} layout
                      onClick={() => setSelectedParty(party)}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-gray-700/30 ${
                        isSelected ? 'bg-blue-50/50 dark:bg-blue-500/5 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-500/5 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {initialLetters(party.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {party.name}
                        </h4>
                        {party.phone && <p className="text-xs text-slate-400 truncate">{party.phone}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(Math.abs(balance))}
                        </p>
                        <p className={`text-[10px] ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {balance >= 0 ? 'Receivable' : 'Payable'}
                        </p>
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <Users className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No parties found</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedParty ? (
              <motion.div key={selectedParty._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-500/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{initialLetters(selectedParty.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedParty.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                          selectedParty._partyType === 'Customer'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        }`}>
                          {selectedParty._partyType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {selectedParty.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedParty.phone}</span>}
                        {selectedParty.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedParty.email}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outstanding</p>
                      <p className={`text-sm font-bold ${(selectedParty.outstandingBalance || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(Math.abs(selectedParty.outstandingBalance || selectedParty.openingBalance || 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-6 lg:p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Party Details</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Select a party from the list to view their complete details, transaction history, and take actions.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg px-4 py-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Name</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedParty.name}</p>
                    </div>
                    {selectedParty.phone && (
                      <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg px-4 py-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedParty.phone}</p>
                      </div>
                    )}
                    {selectedParty.email && (
                      <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg px-4 py-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedParty.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft"
              >
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-32 h-32 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/5 dark:to-purple-500/5 rounded-full flex items-center justify-center mb-6"
                  >
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full flex items-center justify-center">
                      <Users className="w-10 h-10 text-blue-400 dark:text-blue-500/50" />
                    </div>
                  </motion.div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Select a Party</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                    Select a party from the left panel to view their details.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default BusinessNetwork;
