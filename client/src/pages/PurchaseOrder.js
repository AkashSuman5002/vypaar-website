import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Plus, Search, Download, Printer, Eye, Pencil, Trash2, Copy, X,
  ChevronLeft, ChevronRight, IndianRupee, FileText, ShoppingCart,
  Send, Save, Share2, Loader2, Hash, Calendar, CheckCircle, AlertTriangle, Clock,
  MessageSquare, Package, Truck, Ban, ArrowDownToLine,
} from 'lucide-react';

import { purchaseOrderAPI } from '../services/api';
import { generateShareContent, shareToWhatsApp } from '../utils/shareUtils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const ORDER_STATUSES = ['Draft', 'Pending', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];

const PurchaseOrder = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [items, setItems] = useState([{ product: '', qty: 1, unit: 'pcs', price: 0, tax: 0, amount: 0 }]);
  const [form, setForm] = useState({
    supplier: '', orderNo: '', orderDate: new Date().toISOString().split('T')[0],
    dueDate: '', paymentType: 'credit', terms: '', roundOff: 0, status: 'Draft',
  });

  const [receiveForm, setReceiveForm] = useState({ items: [], notes: '' });
  const [cancelReason, setCancelReason] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const { data } = await purchaseOrderAPI.getAll(params);
      setOrders(data.orders || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch purchase orders';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const calcItemAmount = (item) => {
    const qty = parseInt(item.qty, 10) || 0;
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
      supplier: '', orderNo: '', orderDate: new Date().toISOString().split('T')[0], dueDate: '',
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
        product: item.product, productName: item.product,
        quantity: parseInt(item.qty, 10) || 0, rate: parseFloat(item.price) || 0,
        gstRate: parseFloat(item.tax) || 0, amount: parseFloat(item.amount) || 0,
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

  const handleApprove = async (order) => {
    try {
      await purchaseOrderAPI.approve(order._id);
      toast.success('Order approved');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const openReceiveModal = (order) => {
    setSelectedOrder(order);
    setReceiveForm({
      items: (order.items || []).map(item => ({
        itemId: item._id,
        productId: item.product,
        productName: item.productName,
        orderedQuantity: item.quantity,
        receivedQuantity: item.receivedQuantity || 0,
        pendingQuantity: item.pendingQuantity || item.quantity,
        newReceive: 0,
      })),
      notes: '',
    });
    setShowReceiveModal(true);
  };

  const handleReceive = async () => {
    if (!selectedOrder) return;
    const receivedItems = receiveForm.items
      .filter(i => i.newReceive > 0)
      .map(i => ({ itemId: i.itemId, productId: i.productId, receivedQuantity: i.newReceive }));

    if (receivedItems.length === 0) { toast.error('Enter received quantity for at least one item'); return; }

    try {
      await purchaseOrderAPI.receive(selectedOrder._id, { receivedItems, notes: receiveForm.notes });
      toast.success('Stock received successfully');
      setShowReceiveModal(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to receive stock');
    }
  };

  const openCancelModal = (order) => {
    setSelectedOrder(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    try {
      await purchaseOrderAPI.cancel(selectedOrder._id, { reason: cancelReason });
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
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
        orderNumber: '', supplierName: order.supplierName || order.supplier?.name || '',
        orderDate: order.orderDate, expectedDate: order.expectedDate, status: 'Draft',
        notes: order.notes, totalAmount: order.totalAmount,
        items: (order.items || []).map(item => ({
          product: item.product, productName: item.productName,
          quantity: item.quantity, rate: item.rate, gstRate: item.gstRate, amount: item.amount,
        })),
      };
      await purchaseOrderAPI.create(payload);
      toast.success('Order duplicated');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to duplicate order');
    }
  };

  const totalValue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const pendingCount = orders.filter(o => !['received', 'cancelled'].includes(o.status)).length;
  const partiallyReceivedCount = orders.filter(o => o.status === 'partially_received').length;

  const filtered = orders;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusStyles = {
    draft: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300', Draft: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300',
    pending: 'bg-amber-50 text-amber-700', Pending: 'bg-amber-50 text-amber-700',
    ordered: 'bg-blue-50 text-blue-700', Ordered: 'bg-blue-50 text-blue-700',
    partially_received: 'bg-purple-50 text-purple-700', 'Partially Received': 'bg-purple-50 text-purple-700',
    received: 'bg-emerald-50 text-emerald-700', Received: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700', Cancelled: 'bg-red-50 text-red-700',
  };

  if (loading && orders.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  if (orders.length === 0 && !showModal) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Order</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Create and manage purchase orders</p>
        </motion.div>
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16">
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">No Purchase Orders Yet</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Create purchase orders, approve them, and track partial receives.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4 h-4" /> Add Your First Purchase Order</button>
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Create, approve, receive, and track purchase orders</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        ><Plus className="w-4 h-4" /> Add Order</button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl"><ShoppingCart className="w-5 h-5 text-indigo-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Orders</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{orders.length}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Value</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(totalValue)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${pendingCount > 0 ? 'bg-amber-50' : 'bg-slate-50 dark:bg-gray-700'}`}>
              <Clock className={`w-5 h-5 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending</p><p className={`text-xl font-bold mt-1 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{pendingCount}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${partiallyReceivedCount > 0 ? 'bg-purple-50' : 'bg-slate-50 dark:bg-gray-700'}`}>
              <Package className={`w-5 h-5 ${partiallyReceivedCount > 0 ? 'text-purple-600' : 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Partial</p><p className={`text-xl font-bold mt-1 ${partiallyReceivedCount > 0 ? 'text-purple-600' : 'text-slate-900 dark:text-slate-100'}`}>{partiallyReceivedCount}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-2 flex-wrap">
        {['', 'draft', 'pending', 'ordered', 'partially_received', 'received', 'cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
            }`}>
            {s === '' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by supplier or order no..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                {['#', 'Order No', 'Supplier', 'Date', 'Due Date', 'Items', 'Received', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, idx) => {
                const totalReceived = (o.items || []).reduce((s, i) => s + (i.receivedQuantity || 0), 0);
                const totalOrdered = (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <tr key={o._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">{o.orderNumber}</span></td>
                    <td className="px-4 py-3"><span className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.supplierName || o.supplier?.name || ''}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(o.orderDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.expectedDate ? formatDate(o.expectedDate) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.items?.length || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {totalReceived > 0 ? (
                        <span className="text-purple-600 font-medium">{totalReceived}/{totalOrdered}</span>
                      ) : <span className="text-slate-400 dark:text-slate-500">0/{totalOrdered}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${statusStyles[o.status] || statusStyles.draft}`}>
                        {(o.status || 'draft').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {['draft', 'pending'].includes(o.status) && (
                          <button onClick={() => handleApprove(o)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 dark:text-slate-500 hover:text-emerald-600 transition-colors" title="Approve">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {['ordered', 'partially_received'].includes(o.status) && (
                          <button onClick={() => openReceiveModal(o)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 dark:text-slate-500 hover:text-blue-600 transition-colors" title="Receive Stock">
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!['received', 'cancelled'].includes(o.status) && (
                          <button onClick={() => openCancelModal(o)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors" title="Cancel">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDuplicate(o)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60 text-slate-400 dark:text-slate-500 hover:text-purple-600 transition-colors" title="Duplicate">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(o._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{filtered.length} orders</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60 disabled:opacity-30 text-slate-500 dark:text-slate-400"
          ><ChevronLeft className="w-4 h-4" /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700/60'}`}
            >{p}</button>
          ))}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60 disabled:opacity-30 text-slate-500 dark:text-slate-400"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200/80">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{editing ? 'Edit' : 'New'} Purchase Order</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60"><X className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" /></button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Supplier *</label>
                    <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                      placeholder="Enter supplier name"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Order No</label>
                      <input type="text" value={form.orderNo} onChange={e => setForm({ ...form, orderNo: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Order Date</label>
                      <input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Due Date</label>
                      <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Items</h4>
                    <button onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                    ><Plus className="w-3.5 h-3.5" /> Add Row</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-gray-700">
                          {['#', 'Item', 'Qty', 'Unit', 'Price', 'Tax %', 'Amount'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">{h}</th>
                          ))}
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100 dark:border-gray-700">
                            <td className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <input type="text" value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                                placeholder="Item name" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', parseInt(e.target.value, 10) || 0)} min="1" step="1"
                                onKeyDown={(e) => ['.', 'e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                className="no-spinner w-16 px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-center focus:outline-none focus:ring-2" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2">
                                {['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} min="0" step="0.01"
                                className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-right focus:outline-none focus:ring-2" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.tax} onChange={e => updateItem(idx, 'tax', e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2">
                                {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.amount)}</td>
                            <td className="px-3 py-2">
                              {items.length > 1 && (
                                <button onClick={() => removeItem(idx)} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500">
                                  <X className="w-3.5 h-3.5" />
                                </button>
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
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Terms & Conditions</label>
                      <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })}
                        placeholder="Enter terms..." rows={3}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-slate-200 dark:border-gray-700">
                        <span className="text-slate-900 dark:text-slate-100">Grand Total</span>
                        <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700/60">Cancel</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receive Stock Modal */}
      <AnimatePresence>
        {showReceiveModal && selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReceiveModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-200/80">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Receive Stock</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedOrder.orderNumber} — {selectedOrder.supplierName}</p>
                </div>
                <button onClick={() => setShowReceiveModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60"><X className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-700">
                        <th className="px-4 py-2.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                        <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ordered</th>
                        <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Already Received</th>
                        <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending</th>
                        <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-28">Receive Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveForm.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-gray-700 last:border-0">
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{item.productName}</td>
                          <td className="px-4 py-2.5 text-sm text-center text-slate-500 dark:text-slate-400">{item.orderedQuantity}</td>
                          <td className="px-4 py-2.5 text-sm text-center text-emerald-600">{item.receivedQuantity}</td>
                          <td className="px-4 py-2.5 text-sm text-center text-amber-600 font-medium">{item.pendingQuantity}</td>
                          <td className="px-4 py-2.5">
                            <input type="number" min="0" step="1" max={item.pendingQuantity}
                              value={item.newReceive}
                              onKeyDown={(e) => ['.', 'e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                              onChange={e => {
                                const val = Math.min(parseInt(e.target.value, 10) || 0, item.pendingQuantity);
                                setReceiveForm(prev => {
                                  const items = [...prev.items];
                                  items[idx] = { ...items[idx], newReceive: val };
                                  return { ...prev, items };
                                });
                              }}
                              className="no-spinner w-full px-3 py-1.5 text-sm text-center border border-slate-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              placeholder="0" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Notes</label>
                  <input type="text" value={receiveForm.notes} onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                    placeholder="Optional receive notes"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50">
                <button onClick={() => setShowReceiveModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700/60">Cancel</button>
                <button onClick={handleReceive}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm">
                  <ArrowDownToLine className="w-4 h-4" /> Receive Stock
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cancel Order</h3>
                <button onClick={() => setShowCancelModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60"><X className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">Are you sure you want to cancel order <strong>{selectedOrder.orderNumber}</strong>?</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Reason (Optional)</label>
                  <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                    placeholder="Enter cancellation reason..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50">
                <button onClick={() => setShowCancelModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700/60">Keep Order</button>
                <button onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 shadow-sm">
                  <Ban className="w-4 h-4" /> Cancel Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PurchaseOrder;
