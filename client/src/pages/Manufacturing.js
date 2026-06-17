import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Package, CheckCircle, Trash2, X } from 'lucide-react';
import api, { manufacturingAPI, productAPI } from '../services/api';

const STATUS_STYLES = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
];

const emptyBomRow = () => ({ product: '', quantity: '', costPerUnit: '' });

const Manufacturing = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/manufacturing');
      setOrders(res.data.orders || res.data || []);
    } catch (err) {
      toast.error('Failed to load manufacturing orders');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await productAPI.getAll({ limit: 1000 });
      setProducts(res.data.data || res.data.products || res.data || []);
    } catch {
      toast.error('Failed to load products');
    }
  };

  const openCreate = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      orderNumber: '',
      status: 'planned',
      date: today,
      dueDate: '',
      finishedProduct: '',
      plannedQuantity: '',
      labourCost: '',
      overheadCost: '',
      notes: '',
      bomItems: [emptyBomRow()],
    });
    setShowCreate(true);
    loadProducts();
    try {
      const res = await manufacturingAPI.getNextOrder();
      const next = res.data.orderNumber || '';
      setForm(prev => (prev ? { ...prev, orderNumber: next } : prev));
    } catch {
      // server will auto-assign if left blank
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setForm(null);
  };

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const setBomField = (idx, key, value) => {
    setForm(prev => {
      const bomItems = prev.bomItems.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, [key]: value };
        // Prefill cost from product's costPrice when a product is picked
        if (key === 'product') {
          const p = products.find(pr => pr._id === value);
          if (p && (next.costPerUnit === '' || next.costPerUnit === undefined)) {
            next.costPerUnit = p.costPrice != null ? String(p.costPrice) : '';
          }
        }
        return next;
      });
      return { ...prev, bomItems };
    });
  };

  const addBomRow = () => setForm(prev => ({ ...prev, bomItems: [...prev.bomItems, emptyBomRow()] }));
  const removeBomRow = (idx) => setForm(prev => ({
    ...prev,
    bomItems: prev.bomItems.length > 1 ? prev.bomItems.filter((_, i) => i !== idx) : prev.bomItems,
  }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.finishedProduct) return toast.error('Select a finished product');
    if (!form.plannedQuantity || Number(form.plannedQuantity) < 1) return toast.error('Enter a valid output quantity');

    const finished = products.find(p => p._id === form.finishedProduct);

    const bomItems = form.bomItems
      .filter(row => row.product && Number(row.quantity) > 0)
      .map(row => {
        const p = products.find(pr => pr._id === row.product);
        return {
          product: row.product,
          productName: p?.name || '',
          quantity: Number(row.quantity),
          unit: p?.unit || 'pcs',
          costPerUnit: row.costPerUnit !== '' ? Number(row.costPerUnit) : 0,
        };
      });

    const payload = {
      status: form.status || 'planned',
      date: form.date || undefined,
      dueDate: form.dueDate || undefined,
      finishedProduct: form.finishedProduct,
      plannedQuantity: Number(form.plannedQuantity),
      unit: finished?.unit || 'pcs',
      bomItems,
      labourCost: form.labourCost !== '' ? Number(form.labourCost) : 0,
      overheadCost: form.overheadCost !== '' ? Number(form.overheadCost) : 0,
      notes: form.notes || undefined,
    };
    if (form.orderNumber) payload.orderNumber = form.orderNumber;

    try {
      setSubmitting(true);
      await manufacturingAPI.create(payload);
      toast.success('Manufacturing order created');
      closeCreate();
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create manufacturing order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this manufacturing order?')) return;
    try {
      await api.delete(`/manufacturing/${id}`);
      toast.success('Order deleted');
      loadOrders();
    } catch { toast.error('Delete failed'); }
  };

  const handleComplete = async (id) => {
    try {
      await api.post(`/manufacturing/${id}/complete`);
      toast.success('Order marked as completed');
      loadOrders();
    } catch { toast.error('Failed to complete order'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Manufacturing Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track your production orders</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No Manufacturing Orders</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Create your first manufacturing order to get started.</p>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order._id} className="group bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 hover:shadow-card-hover transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{order.orderNumber}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{order.finishedProductName || 'Product'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Qty: {order.producedQuantity || 0}/{order.plannedQuantity || 0}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.planned}`}>
                    {order.status?.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button onClick={() => handleComplete(order._id)}
                        className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-slate-400 hover:text-green-600 transition-colors"
                        title="Mark Complete"><CheckCircle className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => handleDelete(order._id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl my-8 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-gray-700/80">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Manufacturing Order</h2>
              <button onClick={closeCreate}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Order Number</label>
                  <input type="text" value={form.orderNumber}
                    onChange={e => setField('orderNumber', e.target.value)}
                    placeholder="Auto-generated"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Finished Product <span className="text-red-500">*</span></label>
                  <select value={form.finishedProduct} onChange={e => setField('finishedProduct', e.target.value)} required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option value="">Select product…</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Output Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="1" step="any" value={form.plannedQuantity}
                    onChange={e => setField('plannedQuantity', e.target.value)} required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate}
                    onChange={e => setField('dueDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              </div>

              {/* Raw materials / BOM */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Raw Materials</label>
                  <button type="button" onClick={addBomRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700">
                    <Plus className="w-3.5 h-3.5" /> Add material
                  </button>
                </div>
                <div className="space-y-2">
                  {form.bomItems.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select value={row.product} onChange={e => setBomField(idx, 'product', e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                          <option value="">Material…</option>
                          {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="any" placeholder="Qty" value={row.quantity}
                          onChange={e => setBomField(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="any" placeholder="Cost" value={row.costPerUnit}
                          onChange={e => setBomField(idx, 'costPerUnit', e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button type="button" onClick={() => removeBomRow(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Labour Cost</label>
                  <input type="number" min="0" step="any" value={form.labourCost}
                    onChange={e => setField('labourCost', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Overhead Cost</label>
                  <input type="number" min="0" step="any" value={form.overheadCost}
                    onChange={e => setField('overheadCost', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeCreate}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60">
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submitting ? 'Creating…' : 'Create Order'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Manufacturing;
