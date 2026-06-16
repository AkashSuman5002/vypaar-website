import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Package, Clock, CheckCircle, XCircle, Trash2, Eye, Pencil } from 'lucide-react';
import api from '../services/api';

const STATUS_STYLES = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const Manufacturing = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
        {/* KNOWN LIMITATION: no manufacturing-order create form/modal exists in client/src yet.
            manufacturingAPI.create is available, but there is no UI form to collect order data.
            Until a create form/route is built, this guides the user to the existing entry point. */}
        <button onClick={() => toast.info('Create manufacturing order from Settings → Item → Manufacturing')}
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
          <p className="text-sm text-slate-500 dark:text-slate-400">Create your first manufacturing order to get started.</p>
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
    </motion.div>
  );
};

export default Manufacturing;
