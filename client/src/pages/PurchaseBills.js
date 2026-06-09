import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { purchaseAPI, supplierAPI, productAPI, fetchCsrfToken } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Download, Printer, Share2, Eye, Pencil, Trash2, Copy,
  X, ChevronDown, ChevronLeft, ChevronRight, Filter, Calendar, Building2,
  Users, IndianRupee, FileText, ShoppingCart, Hash, Package, Percent,
  ArrowUpDown, CheckCircle, AlertTriangle, Clock, Settings2, Loader2,
  UserCircle, Receipt, Save, Send, Wallet,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const PAYMENT_STATUSES = ['All', 'Paid', 'Partial', 'Unpaid'];
const GST_STATUSES = ['All', 'Regular', 'Composition', 'Unregistered'];

const PurchaseBills = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [gstFilter, setGstFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [dateRange, setDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  const [items, setItems] = useState([{ product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
  const [form, setForm] = useState({
    supplier: '', supplierName: '', invoiceNo: '', invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '', paymentType: 'credit', roundOff: 0, terms: '', grandTotal: 0, paidAmount: 0, status: 'Unpaid',
  });

  const loadData = useCallback(async () => {
    try {
      const [pRes, sRes, prodRes] = await Promise.all([
        purchaseAPI.getAll(), supplierAPI.getAll(), productAPI.getAll(),
      ]);
      setPurchases(Array.isArray(pRes.data) ? pRes.data : pRes.data.purchases || []);
      setSuppliers(sRes.data);
      setProducts(prodRes.data);
    } catch { toast.error('Failed to load purchase data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const calcItemAmount = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    const taxPct = parseFloat(item.tax) || 0;
    const subtotal = qty * price;
    const taxAmount = subtotal * taxPct / 100;
    return subtotal + taxAmount;
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const updated = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      // Recalculate amount
      return updated.map(item => ({ ...item, amount: calcItemAmount(item) }));
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const grandTotal = useMemo(() => {
    const sub = items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    return sub + (parseFloat(form.roundOff) || 0);
  }, [items, form.roundOff]);

  const resetForm = () => {
    setForm({
      supplier: '', supplierName: '', invoiceNo: `PUR-${Date.now().toString(36).toUpperCase()}`,
      invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
      paymentType: 'credit', roundOff: 0, terms: '', grandTotal: 0, paidAmount: 0, status: 'Unpaid',
    });
    setItems([{ product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
    setEditingBill(null);
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

  const handleSave = async () => {
    if (!form.supplierName && !form.supplier) { toast.error('Supplier is required'); return; }
    if (items.length === 0 || items.every(i => !i.product)) { toast.error('At least one item is required'); return; }
    const mappedItems = items.map(item => ({
      productName: item.product || '',
      quantity: parseFloat(item.qty) || 1,
      rate: parseFloat(item.price) || 0,
      gstRate: parseFloat(item.tax) || 0,
      amount: parseFloat(item.amount) || 0,
    }));
    const payload = {
      supplier: form.supplier || undefined,
      supplierName: form.supplierName || suppliers.find(s => s._id === form.supplier)?.name || '',
      date: form.invoiceDate,
      billNumber: form.invoiceNo,
      dueDate: form.dueDate || undefined,
      items: mappedItems,
      totalAmount: grandTotal,
      paidAmount: parseFloat(form.paidAmount) || 0,
      paymentMethod: form.paymentType === 'credit' ? 'cash' : form.paymentType,
      paymentStatus: form.status?.toLowerCase() || 'unpaid',
      notes: form.terms || '',
    };
    try {
      if (editingBill) {
        await purchaseAPI.update(editingBill._id, payload);
        toast.success('Purchase bill updated');
      } else {
        await purchaseAPI.create(payload);
        toast.success('Purchase bill created');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch { toast.error('Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase bill?')) return;
    try {
      await purchaseAPI.delete(id);
      toast.success('Purchase bill deleted');
      loadData();
    } catch { toast.error('Delete failed'); }
  };

  const handleDuplicate = async (bill) => {
    try {
      await purchaseAPI.create({
        supplier: bill.supplier, supplierName: bill.supplierName, date: new Date().toISOString().split('T')[0],
        billNumber: `${bill.billNumber || bill.invoiceNo || 'PUR'}-copy`,
        totalAmount: bill.totalAmount || bill.amount,
        items: (bill.items || []).map(i => ({
          productName: i.productName || i.product || '',
          quantity: i.quantity || i.qty || 1,
          rate: i.rate || i.price || 0,
          gstRate: i.gstRate || i.tax || 0,
          amount: i.amount || 0,
        })),
      });
      toast.success('Bill duplicated');
      loadData();
    } catch { toast.error('Duplicate failed'); }
  };

  // Computed
  const totalPaid = purchases.reduce((s, p) => s + (parseFloat(p.paidAmount) || 0), 0);
  const totalBalance = purchases.reduce((s, p) => s + (p.totalAmount || 0) - (parseFloat(p.paidAmount) || 0), 0);
  const totalAmount = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);

  const filtered = useMemo(() => {
    return purchases.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.supplierName?.toLowerCase().includes(q) || (p.billNumber || p.invoiceNo || '')?.toLowerCase().includes(q) || (p.items || []).some(i => (i.productName || i.product || '')?.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchSupplier = supplierFilter === 'All' || String(p.supplier?._id || p.supplier) === supplierFilter;
      return matchSearch && matchStatus && matchSupplier;
    });
  }, [purchases, searchQuery, statusFilter, supplierFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, supplierFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading purchase bills...</span>
        </div>
      </div>
    );
  }

  if (purchases.length === 0 && !loading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage all your purchase invoices</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: 'spring' }}
              className="w-40 h-40 lg:w-48 lg:h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 rounded-full flex items-center justify-center mb-8"
            >
              <div className="w-32 h-32 lg:w-36 lg:h-36 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full flex items-center justify-center">
                <Receipt className="w-14 h-14 lg:w-16 lg:h-16 text-blue-400 dark:text-blue-500/50" />
              </div>
            </motion.div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">No Purchase Bills Yet</h2>
            <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mb-8">
              Make Purchase invoices &amp; print or share with your customers directly via WhatsApp or Email.
            </p>
            <button onClick={() => navigate('/purchases/bills/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4.5 h-4.5" /> Add Your First Purchase Invoice
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage all your purchase invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
              const headers = ['Bill No', 'Date', 'Supplier', 'Total', 'Paid', 'Status'];
              const rows = purchases.map(b => [b.billNumber || '-', b.date ? new Date(b.date).toLocaleDateString('en-IN') : '-', b.supplierName || '-', b.totalAmount || 0, b.paidAmount || 0, b.paymentStatus || 'unpaid']);
              const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'purchase-bills.csv'; a.click();
              URL.revokeObjectURL(url);
              toast.success('Exported successfully');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => navigate('/purchases/bills/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Bill</button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><IndianRupee className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Amount</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(totalAmount)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"><CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Paid</p><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${totalBalance > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-gray-700'}`}>
              <AlertTriangle className={`w-5 h-5 ${totalBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balance</p><p className={`text-xl font-bold mt-1 ${totalBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{formatCurrency(totalBalance)}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by supplier, invoice no or product..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none"
            >
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'Payment: All' : s}</option>)}
            </select>
            <select value={gstFilter} onChange={e => setGstFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none"
            >
              {GST_STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'GST: All' : s}</option>)}
            </select>
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-gray-700">
          <p className="text-xs text-slate-500">{filtered.length} bills found</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 text-slate-500 transition-colors"
            ><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
              >{p}</button>
            ))}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 text-slate-500 transition-colors"
            ><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                {['#', 'Date', 'Invoice No', 'Supplier', 'Total', 'Paid', 'Balance', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((bill, idx) => {
                const balance = (bill.totalAmount || bill.amount || 0) - (parseFloat(bill.paidAmount) || 0);
                const status = bill.paymentStatus ? (bill.paymentStatus.charAt(0).toUpperCase() + bill.paymentStatus.slice(1)) : (balance <= 0 ? 'Paid' : bill.paidAmount > 0 ? 'Partial' : 'Unpaid');
                const statusStyles = {
                  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
                  Partial: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
                  Unpaid: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
                };
                const statusIcon = { Paid: CheckCircle, Partial: Clock, Unpaid: AlertTriangle };
                const StatIcon = statusIcon[status] || AlertTriangle;
                return (
                  <tr key={bill._id}
                    className="group border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50/50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(bill.date)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">{bill.billNumber || bill.invoiceNo || 'PUR-' + bill._id?.slice(-6)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{bill.supplierName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(bill.totalAmount || bill.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(parseFloat(bill.paidAmount) || 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                        {formatCurrency(balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {status !== 'Paid' ? (
                        <button onClick={() => setPaymentBill(bill)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${statusStyles[status] || statusStyles.Unpaid}`}
                        >
                          <StatIcon className="w-3 h-3" /> {status}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${statusStyles[status] || statusStyles.Unpaid}`}>
                          <StatIcon className="w-3 h-3" /> {status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/purchases/bills/${bill._id}/edit`)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => navigate(`/purchases/bills/${bill._id}/edit`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDuplicate(bill)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-purple-600 transition-colors" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => window.print()}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 transition-colors" title="Print"><Printer className="w-3.5 h-3.5" /></button>
                        <button onClick={() => {
                            const text = `Purchase Bill: ${bill.billNumber || ''}\nSupplier: ${bill.supplierName || ''}\nAmount: ₹${bill.totalAmount || 0}\nStatus: ${bill.paymentStatus || 'unpaid'}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-emerald-600 transition-colors" title="Share"><Share2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(bill._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Add/Edit Modal */}
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
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200/80 dark:border-gray-700"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingBill ? 'Edit Purchase Bill' : 'Purchase Bill'}
                </h3>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                ><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                {/* Supplier + Invoice Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Supplier</label>
                    <div className="space-y-3">
                      <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                      </select>
                      <input type="text" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })}
                        placeholder="Or type supplier name manually"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Invoice No</label>
                      <input type="text" value={form.invoiceNo} onChange={e => setForm({ ...form, invoiceNo: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Invoice Date</label>
                      <input type="date" value={form.invoiceDate} onChange={e => setForm({ ...form, invoiceDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Due Date</label>
                      <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Items</h4>
                    <button onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                    ><Plus className="w-3.5 h-3.5" /> Add Row</button>
                  </div>
                  <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-gray-700/50">
                          {['#', 'Item', 'Qty', 'Unit', 'Price/Unit', 'Tax %', 'Amount'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">{h}</th>
                          ))}
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100 dark:border-gray-700">
                            <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <select value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                  <option value="">Select item</option>
                                  {products.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                                </select>
                                <input type="text" value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                                  placeholder="Or type"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                                min="1"
                                className="w-16 px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2"
                              >
                                {['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)}
                                min="0" step="0.01"
                                className="w-24 px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.tax} onChange={e => updateItem(idx, 'tax', e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2"
                              >
                                {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="px-3 py-2">
                              {items.length > 1 && (
                                <button onClick={() => removeItem(idx)}
                                  className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                                ><X className="w-3.5 h-3.5" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-gray-700">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Payment Type</label>
                      <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2"
                      >
                        <option value="credit">Credit</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="upi">UPI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Terms & Conditions</label>
                      <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })}
                        placeholder="Enter terms and conditions..."
                        rows={3}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Round Off</span>
                        <input type="number" value={form.roundOff} onChange={e => setForm({ ...form, roundOff: e.target.value })}
                          className="w-24 px-3 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-200 dark:border-gray-600">
                        <span className="text-slate-900 dark:text-slate-100">Grand Total</span>
                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Paid Amount</label>
                      <input type="number" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                >Cancel</button>
                <button onClick={() => {
                    const text = `Purchase Bill\nBill No: ${form.billNumber || ''}\nSupplier: ${form.supplierName || ''}\nTotal: ₹${form.totalAmount || 0}\nPaid: ₹${form.paidAmount || 0}\nStatus: ${form.paymentStatus || 'unpaid'}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-400 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-gray-600 transition-all"
                ><Send className="w-4 h-4" /> Share</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                ><Save className="w-4 h-4" /> Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentBill && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPaymentBill(null)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-md p-6 border border-slate-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Make Payment</h3>
              <div className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bill</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{paymentBill.billNumber || paymentBill.invoiceNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Supplier</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{paymentBill.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(paymentBill.totalAmount || paymentBill.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Paid</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(paymentBill.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-gray-600 pt-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Due</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(Math.max(0, (paymentBill.totalAmount || paymentBill.amount || 0) - (parseFloat(paymentBill.paidAmount) || 0)))}</span>
                </div>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const amount = parseFloat(e.target.amount.value) || 0;
                const method = e.target.method.value || 'cash';
                const due = Math.max(0, (paymentBill.totalAmount || paymentBill.amount || 0) - (parseFloat(paymentBill.paidAmount) || 0));
                if (amount <= 0) { toast.error('Enter a valid amount'); return; }
                if (amount > due) { toast.error('Amount exceeds due balance'); return; }
                try {
                  await fetchCsrfToken();
                  const newPaid = (parseFloat(paymentBill.paidAmount) || 0) + amount;
                  await purchaseAPI.update(paymentBill._id, { paidAmount: newPaid, paymentMethod: method });
                  toast.success('Payment recorded');
                  setPaymentBill(null);
                  loadData();
                } catch (err) { toast.error(err.response?.data?.message || 'Failed to record payment'); }
              }} className="space-y-4" noValidate>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Amount</label>
                  <input type="number" name="amount" step="0.01" required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Method</label>
                  <select name="method"
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={() => setPaymentBill(null)}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >Cancel</button>
                  <button type="submit"
                    className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                  >Confirm Payment</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PurchaseBills;
