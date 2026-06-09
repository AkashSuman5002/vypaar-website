import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';
import EmptyState from '../components/CashBank/EmptyState';
import { chequeAPI } from '../services/api';

const Cheques = () => {
  const [openMenu, setOpenMenu] = useState(false);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await chequeAPI.getAll();
      setCheques(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (!loading && cheques.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Cheque Details</h1>
          <div className="relative">
            <button onClick={() => setOpenMenu(!openMenu)} className="p-2 rounded-md hover:bg-gray-200 transition-colors"><MoreHorizontal className="w-5 h-5 text-gray-600" /></button>
            {openMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Manage Columns</button>
                  <button onClick={() => {
                    const headers = ['Date', 'Cheque No.', 'Bank Name', 'Customer', 'Amount'];
                    const rows = cheques.map(c => [c.date ? new Date(c.date).toLocaleDateString('en-IN') : '-', c.chequeNo || '-', c.bankName || '-', c.customerName || '-', c.amount || 0]);
                    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'cheques.csv'; a.click();
                    URL.revokeObjectURL(url);
                    toast.success('CSV exported');
                    setOpenMenu(false);
                  }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export as CSV</button>
                  <button onClick={() => {
                    const headers = ['Date', 'Cheque No.', 'Bank Name', 'Customer', 'Amount'];
                    const rows = cheques.map(c => [c.date ? new Date(c.date).toLocaleDateString('en-IN') : '-', c.chequeNo || '-', c.bankName || '-', c.customerName || '-', c.amount || 0]);
                    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'cheques.csv'; a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Excel exported');
                    setOpenMenu(false);
                  }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export as Excel</button>
                </div>
              </>
            )}
          </div>
        </div>
        <EmptyState
          icon={<svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="20" width="70" height="50" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="35" x2="75" y2="35" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="42" x2="75" y2="42" stroke="#D1D5DB" strokeWidth="1" /><line x1="25" y1="49" x2="60" y2="49" stroke="#D1D5DB" strokeWidth="1" /><rect x="62" y="45" width="12" height="8" rx="1" fill="#9CA3AF" /><text x="68" y="51" textAnchor="middle" fontSize="6" fill="white">₹</text><rect x="62" y="32" width="8" height="4" rx="0.5" fill="#9CA3AF" /><rect x="25" y="56" width="8" height="4" rx="0.5" fill="#9CA3AF" /><rect x="36" y="56" width="8" height="4" rx="0.5" fill="#9CA3AF" /><rect x="47" y="56" width="8" height="4" rx="0.5" fill="#9CA3AF" /></svg>}
          title="No Cheques to Show"
          subtitle="You haven't added any Cheque transactions yet."
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Cheque Details</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cheque No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bank Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c, i) => (
                <tr key={c._id || i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{c.date ? new Date(c.date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.chequeNo || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.bankName || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.customerName || '-'}</td>
                  <td className="px-4 py-3 text-gray-900 text-right font-medium">₹{(c.amount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default Cheques;