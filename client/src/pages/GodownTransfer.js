import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { godownAPI, productAPI, godownTransferAPI } from '../services/api';
import {
  Plus, Search, Trash2, X, ChevronLeft, ChevronRight, ArrowRightLeft,
  Save, Loader2, ArrowRight, Package, Warehouse, Minus,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const GodownTransfer = () => {
  const [transfers, setTransfers] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const [form, setForm] = useState({
    fromGodown: '', toGodown: '', items: [], date: new Date().toISOString().split('T')[0], notes: '',
  });
  const [itemSearch, setItemSearch] = useState('');
  const [productDropdown, setProductDropdown] = useState([]);

  const fetchTransfers = async (page = 1) => {
    try {
      const params = searchQuery ? { page: 1, limit: 10000 } : { page, limit: pageSize };
      const { data } = await godownTransferAPI.getAll(params);
      setTransfers(data.transfers || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransfers(currentPage); }, [currentPage, searchQuery]);

  useEffect(() => {
    Promise.all([
      godownAPI.getAll().catch(() => ({ data: [] })),
      productAPI.getAll({ limit: 500 }).catch(() => ({ data: { data: [] } })),
    ]).then(([g, p]) => {
      setGodowns(g.data || []);
      setProducts(p.data?.data || []);
    });
  }, []);

  const searchProducts = useCallback(async (q) => {
    if (!q || q.length < 1) { setProductDropdown([]); return; }
    try {
      const params = { search: q, limit: 20 };
      // Only offer products that currently belong to the selected source godown
      if (form.fromGodown) params.warehouse = form.fromGodown;
      const { data } = await productAPI.getAll(params);
      setProductDropdown(data?.data || []);
    } catch { setProductDropdown([]); }
  }, [form.fromGodown]);

  useEffect(() => { searchProducts(itemSearch); }, [itemSearch, searchProducts]);

  // Available quantity of a product in the selected source godown. Falls back to the
  // global stock when the product has no per-godown distribution yet (legacy data).
  const availableInSource = (product) => {
    if (!form.fromGodown) return product.stock ?? 0;
    const gs = product.godownStock || [];
    if (gs.length === 0) {
      // Legacy: whole stock is treated as residing in its current warehouse.
      return product.warehouse === form.fromGodown ? (product.stock ?? 0) : 0;
    }
    const entry = gs.find(e => (e.godown?._id || e.godown) === form.fromGodown);
    return entry ? entry.quantity : 0;
  };

  const addItem = (product) => {
    if (form.items.find(i => i.product === product._id)) {
      toast.warn('Item already added');
      return;
    }
    const maxStock = availableInSource(product);
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product: product._id, productName: product.name, quantity: 1, unit: product.unit || 'pcs', maxStock }],
    }));
    setItemSearch('');
    setProductDropdown([]);
  };

  const updateItemQty = (idx, qty) => {
    setForm(prev => {
      const items = [...prev.items];
      const max = items[idx].maxStock;
      let q = Math.max(1, parseInt(qty) || 1);
      if (Number.isFinite(max) && max > 0 && q > max) q = max;
      items[idx].quantity = q;
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const resetForm = () => {
    setForm({ fromGodown: '', toGodown: '', items: [], date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const handleSave = async () => {
    if (!form.fromGodown || !form.toGodown) { toast.error('Select both godowns'); return; }
    if (form.fromGodown === form.toGodown) { toast.error('Cannot transfer to same godown'); return; }
    if (form.items.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await godownTransferAPI.create(form);
      toast.success('Transfer completed');
      setShowModal(false);
      resetForm();
      fetchTransfers(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transfer? Stock will be reversed.')) return;
    try {
      await godownTransferAPI.delete(id);
      toast.success('Transfer deleted');
      fetchTransfers(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const displayEntries = searchQuery
    ? transfers.filter(t => {
        const q = searchQuery.toLowerCase();
        return t.transferNumber?.toLowerCase().includes(q) || t.fromGodownName?.toLowerCase().includes(q) || t.toGodownName?.toLowerCase().includes(q);
      })
    : transfers;
  const paginated = displayEntries.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Godown Transfer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Transfer stock between warehouses</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        ><Plus className="w-4 h-4" /> New Transfer</button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl"><ArrowRightLeft className="w-5 h-5 text-indigo-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transfers</p><p className="text-xl font-bold text-slate-900 mt-1">{transfers.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><Warehouse className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Godowns</p><p className="text-xl font-bold text-slate-900 mt-1">{godowns.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-xl"><Package className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Products</p><p className="text-xl font-bold text-slate-900 mt-1">{products.length}</p></div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by transfer number or godown name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </motion.div>

      {transfers.length === 0 ? (
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full flex items-center justify-center mb-6">
              <ArrowRightLeft className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Transfers Yet</h2>
            <p className="text-sm text-slate-500 mb-6">Transfer stock between your godowns/warehouses.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4 h-4" /> New Transfer</button>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Date', 'Transfer No', 'From', 'To', 'Items', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t, idx) => (
                    <tr key={t._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(t.date)}</td>
                      <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{t.transferNumber}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-red-50"><Minus className="w-3.5 h-3.5 text-red-500" /></div>
                          <span className="text-sm font-medium text-slate-900">{t.fromGodownName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-emerald-50"><Plus className="w-3.5 h-3.5 text-emerald-500" /></div>
                          <span className="text-sm font-medium text-slate-900">{t.toGodownName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-slate-600">{t.totalItems} items</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-2xs font-semibold rounded-full ${
                          t.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          t.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(t._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{displayEntries.length} transfers</p>
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
        </>
      )}

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
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Godown to Godown Transfer</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">From Godown *</label>
                    <select value={form.fromGodown} onChange={e => setForm({ ...form, fromGodown: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Select Source</option>
                      {godowns.filter(g => g._id !== form.toGodown).map(g => (
                        <option key={g._id} value={g._id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">To Godown *</label>
                    <select value={form.toGodown} onChange={e => setForm({ ...form, toGodown: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Select Destination</option>
                      {godowns.filter(g => g._id !== form.fromGodown).map(g => (
                        <option key={g._id} value={g._id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Optional notes" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Add Items *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                      placeholder="Search products by name, SKU, or barcode..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    {productDropdown.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {productDropdown.map(p => (
                          <button key={p._id} onClick={() => addItem(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors">
                            <span className="text-slate-900">{p.name}</span>
                            <span className="text-xs text-slate-400">Stock: {p.stock} {p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {form.items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2.5 text-left text-2xs font-semibold text-slate-500 uppercase">Item</th>
                          <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 uppercase">Avail.</th>
                          <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 uppercase w-32">Qty</th>
                          <th className="px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{item.productName}</td>
                            <td className="px-4 py-2.5 text-sm text-center text-slate-500">{item.maxStock} {item.unit}</td>
                            <td className="px-4 py-2.5">
                              <input type="number" value={item.quantity} onChange={e => updateItemQty(idx, e.target.value)}
                                onKeyDown={(e) => ['.', 'e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                min="1" step="1" className="no-spinner w-full px-3 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm"
                ><Save className="w-4 h-4" /> Transfer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GodownTransfer;
