import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Users, IndianRupee, Search, TrendingUp, Calendar } from 'lucide-react';
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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Track Your Salesmen</h1>
          <p className="text-sm text-slate-400 mt-0.5">Monitor salesman performance based on customer assignments and sales data.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64" placeholder="Search salesmen..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-slate-400">Total Salesmen</p><p className="text-xl font-bold text-slate-900">{salesmen.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-xs text-slate-400">Total Revenue</p><p className="text-xl font-bold text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-slate-400">Total Invoices</p><p className="text-xl font-bold text-slate-900">{totalSales}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><IndianRupee className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-xs text-slate-400">Avg. per Salesman</p><p className="text-xl font-bold text-slate-900">₹{salesmen.length > 0 ? Math.round(totalAmount / salesmen.length).toLocaleString('en-IN') : 0}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Salesman</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Customers</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Invoices</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Total Amount</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Last Sale</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-400">Loading salesmen data...</td></tr>
            ) : filteredSalesmen.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center">
                <div className="flex flex-col items-center">
                  <Users className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400 mb-1">No salesman data found</p>
                  <p className="text-xs text-slate-400">Assign salesmen to customers in Party Details to track their performance.</p>
                </div>
              </td></tr>
            ) : filteredSalesmen.map((s, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">{s.name?.charAt(0)?.toUpperCase() || '?'}</div><div><p className="text-sm font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-400">{s.customers} customer(s)</p></div></div></td>
                <td className="px-6 py-4 text-sm text-slate-600">{s.customers || 0}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{s.totalSales || 0}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">₹{(s.totalAmount || 0).toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{s.lastActive ? new Date(s.lastActive).toLocaleDateString('en-IN') : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default TrackYourSalesmen;
