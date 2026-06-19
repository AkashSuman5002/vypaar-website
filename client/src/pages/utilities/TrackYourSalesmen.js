import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Users, IndianRupee, Search, TrendingUp, Calendar, Percent, AlertCircle } from 'lucide-react';
import { utilityAPI } from '../../services/api';

const TrackYourSalesmen = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSalesmen = useCallback(async () => {
    setLoading(true);
    try {
      const res = await utilityAPI.getSalesmenTracking();
      setSalesmen(res.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load salesmen data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSalesmen(); }, [loadSalesmen]);

  const filteredSalesmen = salesmen.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalAmount = salesmen.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const totalSales = salesmen.reduce((acc, s) => acc + (s.totalSales || 0), 0);
  const totalCommission = salesmen.reduce((acc, s) => acc + (s.commissionEarned || 0), 0);
  const totalPending = salesmen.reduce((acc, s) => acc + (s.pendingAmount || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">Track Your Salesmen</h1>
          <p className="text-sm text-slate-400 dark:text-[#64748B] mt-0.5">Monitor salesman performance, commissions, and pending collections.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-sm text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64" placeholder="Search salesmen..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-slate-400 dark:text-[#64748B]">Total Salesmen</p><p className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">{salesmen.length}</p></div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-xs text-slate-400 dark:text-[#64748B]">Total Revenue</p><p className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString('en-IN')}</p></div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-slate-400 dark:text-[#64748B]">Total Invoices</p><p className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">{totalSales}</p></div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center"><Percent className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-xs text-slate-400 dark:text-[#64748B]">Total Commission</p><p className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">₹{totalCommission.toLocaleString('en-IN')}</p></div>
        </div>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-600" /></div>
          <div><p className="text-xs text-slate-400 dark:text-[#64748B]">Pending Collection</p><p className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">₹{totalPending.toLocaleString('en-IN')}</p></div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#334155]">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Salesman</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Customers</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Invoices</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Total Amount</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Pending</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Commission %</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Commission</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Last Sale</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">Loading salesmen data...</td></tr>
            ) : filteredSalesmen.length === 0 ? (
              <tr><td colSpan="8" className="px-6 py-12 text-center">
                <div className="flex flex-col items-center">
                  <Users className="w-12 h-12 text-slate-300 dark:text-[#475569] mb-3" />
                  <p className="text-sm text-slate-400 dark:text-[#64748B] mb-1">No salesman data found</p>
                  <p className="text-xs text-slate-400 dark:text-[#64748B]">Add staff with salesman role or assign salesmen to customers.</p>
                </div>
              </td></tr>
            ) : filteredSalesmen.map((s, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-[#334155] hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/70 transition-colors">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">{s.name?.charAt(0)?.toUpperCase() || '?'}</div><div><p className="text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">{s.name}</p><p className="text-xs text-slate-400 dark:text-[#64748B]">{s.customers} customer(s)</p></div></div></td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-[#94A3B8]">{s.customers || 0}</td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-[#94A3B8]">{s.totalSales || 0}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">₹{(s.totalAmount || 0).toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-sm font-medium text-red-600 dark:text-red-400">₹{(s.pendingAmount || 0).toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-[#94A3B8]">{s.commissionRate || 0}%</td>
                <td className="px-6 py-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">₹{(s.commissionEarned || 0).toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-[#64748B]">{s.lastActive ? new Date(s.lastActive).toLocaleDateString('en-IN') : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default TrackYourSalesmen;
