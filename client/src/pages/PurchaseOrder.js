import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Download, Printer, Eye, Pencil, Trash2, Copy, X,
  ChevronLeft, ChevronRight, IndianRupee, FileText, ShoppingCart,
  Send, Save, Share2, Loader2, Hash, Calendar, CheckCircle, AlertTriangle, Clock,
} from 'lucide-react';

import { purchaseOrderAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const ORDER_STATUSES = ['Draft', 'Confirmed', 'Shipped', 'Received', 'Cancelled'];

const PurchaseOrder = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState([{ product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
  const [form, setForm] = useState({
    supplier: '', orderNo: '', orderDate: new Date().toISOString().split('T')[0],
    dueDate: '', paymentType: 'credit', terms: '', roundOff: 0, status: 'Draft',
  });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await purchaseOrderAPI.getAll();
      setOrders(data.orders || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch purchase orders';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const calcItemAmount = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    const taxPct = parseFloat(item.tax) || 0;
    return qty * price * (1 + taxPct / 100);
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.amount = calcItemAmount(updated);
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, { product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
  const removeItem = (idx) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  const grandTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) + (parseFloat(form.roundOff) || 0);

  const resetForm = () => {
    setForm({
      supplier: '', orderNo: `PO-${Date.now().toString(36).toUpperCase()}`,
      orderDate: new Date().toISOString().split('T')[0], dueDate: '',
      paymentType: 'credit', terms: '', roundOff: 0, status: 'Draft',
    });
    setItems([{ product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.supplier) { toast.error('Supplier is required'); return; }
    if (items.every(i => !i.product)) { toast.error('At least one item is required'); return; }
    const payload = {
      orderNumber: form.orderNo,
      supplierName: form.supplier,
      orderDate: form.orderDate,
      expectedDate: form.dueDate,
      status: form.status,
      notes: form.terms,
      roundOff: parseFloat(form.roundOff) || 0,
      totalAmount: grandTotal,
      items: items.map(item => ({
        product: item.product,
        qty: parseFloat(item.qty) || 0,
        unit: item.unit,
        price: parseFloat(item.price) || 0,
        tax: parseFloat(item.tax) || 0,
        amount: parseFloat(item.amount) || 0,
      })),
    };
    try {
      if (editing) {
        await purchaseOrderAPI.update(editing._id, payload);
        toast.success('Purchase order updated');
      } else {
        await purchaseOrderAPI.create(payload);
        toast.success('Purchase order created');
      }
      setShowModal(false);
      resetForm();
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save purchase order');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase order?')) return;
    try {
      await purchaseOrderAPI.delete(id);
      toast.success('Purchase order deleted');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  const handleDuplicate = async (order) => {
    try {
      const payload = {
        orderNumber: `${order.orderNumber}-copy`,
        supplierName: order.supplierName || order.supplier?.name || '',
        orderDate: order.orderDate,
        expectedDate: order.expectedDate,
        status: 'Draft',
        notes: order.notes,
        roundOff: order.roundOff || 0,
        totalAmount: order.totalAmount,
        items: (order.items || []).map(item => ({
          product: item.product,
          qty: item.qty,
          unit: item.unit,
          price: item.price,
          tax: item.tax,
          amount: item.amount,
        })),
      };
      await purchaseOrderAPI.create(payload);
      toast.success('Order duplicated');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate order');
    }
  };

  const totalValue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const pendingCount = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled').length;

  const filtered = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const sName = o.supplierName || o.supplier?.name || '';
    return !q || sName.toLowerCase().includes(q) || (o.orderNumber || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusStyles = {
    Draft: 'bg-slate-100 text-slate-700',
    Confirmed: 'bg-blue-50 text-blue-700',
    Shipped: 'bg-purple-50 text-purple-700',
    Received: 'bg-emerald-50 text-emerald-700',
    Cancelled: 'bg-red-50 text-red-700',
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error && orders.length === 0 && !showModal) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage purchase orders</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/5 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Failed to Load Orders</h2>
            <p className="text-sm text-slate-500 mb-8">{error}</p>
            <button onClick={fetchOrders}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >Retry</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (orders.length === 0 && !showModal) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage purchase orders</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16"
        >
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-500/5 rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">No Purchase Orders Yet</h2>
            <p className="text-sm text-slate-500 mb-8">
              Make &amp; share purchase orders with your parties &amp; convert them to purchase bill instantly.
            </p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4.5 h-4.5" /> Add Your First Purchase Order</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage purchase orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.info('Export')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
          ><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          ><Plus className="w-4.5 h-4.5" /> Add Order</button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl"><ShoppingCart className="w-5 h-5 text-indigo-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Orders</p><p className="text-xl font-bold text-slate-900 mt-1">{orders.length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Value</p><p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalValue)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${pendingCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <Clock className={`w-5 h-5 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending</p><p className={`text-xl font-bold mt-1 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{pendingCount}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by supplier or order no..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Order No', 'Supplier', 'Date', 'Due Date', 'Items', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, idx) => (
                <tr key={o._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 font-mono">{o.orderNumber}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-slate-900">{o.supplierName || o.supplier?.name || ''}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(o.orderDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{o.expectedDate ? formatDate(o.expectedDate) : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{o.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(o.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${statusStyles[o.status] || statusStyles.Draft}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDuplicate(o)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-purple-600 transition-colors" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Print"><Printer className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(o._id)}
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
        <p className="text-xs text-slate-500">{filtered.length} orders</p>
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

      {/* Add Order Modal */}
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
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Purchase Order</h3>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                ><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Supplier</label>
                    <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                      placeholder="Enter supplier name"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Order No</label>
                      <input type="text" value={form.orderNo} onChange={e => setForm({ ...form, orderNo: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Order Date</label>
                      <input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Due Date</label>
                      <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">Items</h4>
                    <button onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                    ><Plus className="w-3.5 h-3.5" /> Add Row</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          {['#', 'Item', 'Qty', 'Unit', 'Price', 'Tax %', 'Amount'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                          ))}
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <input type="text" value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                                placeholder="Item name"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} min="1"
                                className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                              >
                                {['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} min="0" step="0.01"
                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.tax} onChange={e => updateItem(idx, 'tax', e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                              >
                                {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</td>
                            <td className="px-3 py-2">
                              {items.length > 1 && (
                                <button onClick={() => removeItem(idx)}
                                  className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                ><X className="w-3.5 h-3.5" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Payment Type</label>
                      <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                      >
                        <option value="credit">Credit</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Terms & Conditions</label>
                      <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })}
                        placeholder="Enter terms..."
                        rows={3}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Round Off</span>
                        <input type="number" value={form.roundOff} onChange={e => setForm({ ...form, roundOff: e.target.value })}
                          className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-200">
                        <span className="text-slate-900">Grand Total</span>
                        <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2"
                      >
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >Cancel</button>
                <button onClick={() => toast.info('Share feature')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50"
                ><Send className="w-4 h-4" /> Share</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                ><Save className="w-4 h-4" /> Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PurchaseOrder;
