import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Download, Printer, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, IndianRupee, FileText, RotateCcw,
  Share2, Calendar, Hash, Users, Tag,
  Loader2,
} from 'lucide-react';
import { purchaseReturnAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const TRANSACTION_TYPES = [
  'Sale', 'Purchase', 'Payment-In', 'Payment-Out', 'Credit Note', 'Debit Note',
  'Sale Order', 'Purchase Order', 'Estimate', 'Proforma Invoice', 'Delivery Challan',
  'Expense', 'Journal Entry',
];

const REASONS = ['Damaged Goods', 'Defective Product', 'Wrong Item', 'Excess Quantity', 'Quality Issue', 'Other'];

const PurchaseReturn = () => {
  const navigate = useNavigate();
  const [debits, setDebits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchDebits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await purchaseReturnAPI.getAll({});
      setDebits(data.returns || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch purchase returns');
      toast.error('Failed to load debit notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDebits(); }, [fetchDebits]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this debit note?')) return;
    try {
      await purchaseReturnAPI.delete(id);
      toast.success('Debit note deleted');
      fetchDebits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete debit note');
    }
  };

  const totalAmount = debits.reduce((s, d) => s + d.totalAmount, 0);

  const filtered = debits.filter(d => {
    const q = searchQuery.toLowerCase();
    return !q || d.supplierName?.toLowerCase().includes(q) || d.returnNumber?.toLowerCase().includes(q) || d.reason?.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Return / Debit Note</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage returns and debit notes</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16 flex items-center justify-center"
        >
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </motion.div>
      </motion.div>
    );
  }

  if (debits.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Return / Debit Note</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage returns and debit notes</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/5 rounded-full flex items-center justify-center mb-6">
              <RotateCcw className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Debit Notes Yet</h2>
            <p className="text-sm text-slate-500 mb-6">Record purchase returns and issue debit notes to suppliers.</p>
            <button onClick={() => navigate('/purchases/returns/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4.5 h-4.5" /> Add Debit Note</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Return / Debit Note</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage returns and debit notes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
              const headers = ['Date', 'Return No.', 'Party', 'Amount', 'Status'];
              const rows = filtered.map(r => [formatDate(r.date), r.returnNumber || r.invoiceNumber, r.supplierName || '-', r.totalAmount || 0, r.status || 'confirmed']);
              const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'purchase-returns.csv'; a.click();
              URL.revokeObjectURL(url);
              toast.success('Exported successfully');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => navigate('/purchases/returns/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Debit Note</button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by supplier, debit no or reason..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={transactionType} onChange={e => setTransactionType(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2"
            >
              <option value="all">All Transactions</option>
              {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors">
              <Calendar className="w-4 h-4" /> This Month
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-xl"><RotateCcw className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Returns</p><p className="text-xl font-bold text-slate-900 mt-1">{debits.length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-xl"><IndianRupee className="w-5 h-5 text-orange-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</p><p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalAmount)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><Tag className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Returns</p><p className="text-xl font-bold text-slate-900 mt-1">{debits.filter(d => d.reason !== 'Resolved').length}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Date', 'Reference No', 'Party Name', 'Category', 'Type', 'Total', 'Received/Paid', 'Balance', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((d, idx) => (
                <tr key={d._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(d.returnDate)}</td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 font-mono">{d.returnNumber}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-slate-900">{d.supplierName}</span></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-md">Debit Note</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{d.reason || '—'}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900">{formatCurrency(d.totalAmount)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-emerald-600 font-semibold">{formatCurrency(0)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-amber-600 font-semibold">{formatCurrency(d.totalAmount)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => navigate(`/purchases/returns/${d._id}/edit`)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => navigate(`/purchases/returns/${d._id}/edit`)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(d._id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{filtered.length} debit notes</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"
          ><ChevronLeft className="w-4 h-4" /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >{p}</button>
          ))}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </motion.div>
  );
};

export default PurchaseReturn;
