import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/format';
import { godownAPI, stockReconciliationAPI } from '../services/api';
import {
  Plus, Search, Trash2, X, ChevronLeft, ChevronRight, ClipboardCheck,
  Save, Loader2, CheckCircle, AlertTriangle, Package, ArrowRight,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const StockReconciliation = () => {
  const [reconciliations, setReconciliations] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 10;

  const [form, setForm] = useState({
    godown: '', items: [], date: new Date().toISOString().split('T')[0], notes: '',
  });
  const [itemSearch, setItemSearch] = useState('');
  const [stockItems, setStockItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);

  const fetchReconciliations = async (page = 1) => {
    try {
      const params = { page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      const { data } = await stockReconciliationAPI.getAll(params);
      setReconciliations(data.reconciliations || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to load reconciliations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReconciliations(currentPage); }, [currentPage, statusFilter]);

  useEffect(() => {
    godownAPI.getAll().then(({ data }) => setGodowns(Array.isArray(data) ? data : data?.data || [])).catch(() => {});
  }, []);

  const loadStockItems = useCallback(async () => {
    try {
      const params = {};
      if (form.godown) params.godown = form.godown;
      if (itemSearch) params.search = itemSearch;
      const { data } = await stockReconciliationAPI.getStockForCount(params);
      setStockItems(data.items || []);
      setFilteredItems(data.items || []);
    } catch { toast.error('Failed to load stock'); }
  }, [form.godown, itemSearch]);

  useEffect(() => { if (showModal) loadStockItems(); }, [showModal, loadStockItems]);

  useEffect(() => {
    if (itemSearch) {
      setFilteredItems(stockItems.filter(i =>
        i.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
        i.sku?.toLowerCase().includes(itemSearch.toLowerCase()) ||
        i.barcode?.toLowerCase().includes(itemSearch.toLowerCase())
      ));
    } else {
      setFilteredItems(stockItems);
    }
  }, [itemSearch, stockItems]);

  const addItem = (item) => {
    if (form.items.find(i => i.product === item._id)) {
      toast.warn('Item already in count list');
      return;
    }
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product: item._id, productName: item.name, systemStock: item.stock,
        countedStock: item.stock, unit: item.unit || 'pcs', reason: '',
      }],
    }));
  };

  const addAllItems = () => {
    let added = 0;
    const newItems = [...form.items];
    for (const item of stockItems) {
      if (!newItems.find(i => i.product === item._id)) {
        newItems.push({
          product: item._id, productName: item.name, systemStock: item.stock,
          countedStock: item.stock, unit: item.unit || 'pcs', reason: '',
        });
        added++;
      }
    }
    setForm(prev => ({ ...prev, items: newItems }));
    if (added > 0) toast.success(`Added ${added} items`);
    else toast.info('All items already added');
  };

  const updateCounted = (idx, val) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx].countedStock = Math.max(0, parseInt(val) || 0);
      return { ...prev, items };
    });
  };

  const updateReason = (idx, val) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx].reason = val;
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const resetForm = () => {
    setForm({ godown: '', items: [], date: new Date().toISOString().split('T')[0], notes: '' });
    setItemSearch('');
  };

  const handleSave = async (apply = false) => {
    if (form.items.length === 0) { toast.error('Add at least one item to count'); return; }
    try {
      const { data } = await stockReconciliationAPI.create(form);
      if (apply) {
        await stockReconciliationAPI.apply(data._id);
        toast.success('Reconciliation created and applied');
      } else {
        toast.success('Reconciliation saved as draft');
      }
      setShowModal(false);
      resetForm();
      fetchReconciliations(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleApply = async (id) => {
    if (!window.confirm('Apply this reconciliation? Stock levels will be adjusted.')) return;
    try {
      await stockReconciliationAPI.apply(id);
      toast.success('Reconciliation applied');
      fetchReconciliations(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reconciliation?')) return;
    try {
      await stockReconciliationAPI.delete(id);
      toast.success('Reconciliation deleted');
      fetchReconciliations(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const discrepancyCount = form.items.filter(i => i.countedStock !== i.systemStock).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Compare system stock vs physical count and adjust</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        ><Plus className="w-4 h-4" /> New Reconciliation</button>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-2">
        {['', 'draft', 'applied', 'cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </motion.div>

      {reconciliations.length === 0 ? (
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft p-12 lg:p-16">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-28 h-28 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mb-6">
              <ClipboardCheck className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Reconciliations Yet</h2>
            <p className="text-sm text-slate-500 mb-6">Start a physical stock count and reconcile with system stock.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            ><Plus className="w-4 h-4" /> New Reconciliation</button>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Date', 'Reconciliation No', 'Godown', 'Items', 'Discrepancies', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 uppercase tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((r, idx) => (
                    <tr key={r._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(r.date)}</td>
                      <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{r.reconciliationNumber}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.godownName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.totalItems}</td>
                      <td className="px-4 py-3">
                        {r.totalDiscrepancies > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm text-amber-600 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> {r.totalDiscrepancies}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> 0
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-2xs font-semibold rounded-full ${
                          r.status === 'applied' ? 'bg-emerald-50 text-emerald-700' :
                          r.status === 'draft' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {r.status === 'draft' && (
                            <button onClick={() => handleApply(r._id)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 transition-colors" title="Apply">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {r.status !== 'applied' && (
                            <button onClick={() => handleDelete(r._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{reconciliations.length} reconciliations</p>
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
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-slate-900">Stock Reconciliation</h3>
                  {discrepancyCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">
                      <AlertTriangle className="w-3 h-3" /> {discrepancyCount} discrepancies
                    </span>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Godown (Optional)</label>
                    <select value={form.godown} onChange={e => setForm({ ...form, godown: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="">All Godowns</option>
                      {godowns.map(g => (
                        <option key={g._id} value={g._id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                      placeholder="Search products to add..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    {filteredItems.length > 0 && itemSearch && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredItems.slice(0, 10).map(item => (
                          <button key={item._id} onClick={() => { addItem(item); setItemSearch(''); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors">
                            <span className="text-slate-900">{item.name}</span>
                            <span className="text-xs text-slate-400">Stock: {item.stock} {item.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={addAllItems}
                    className="px-4 py-2.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap">
                    Add All Items
                  </button>
                </div>

                {form.items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2.5 text-left text-2xs font-semibold text-slate-500 uppercase">Item</th>
                          <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 uppercase">System</th>
                          <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 uppercase w-28">Counted</th>
                          <th className="px-4 py-2.5 text-center text-2xs font-semibold text-slate-500 uppercase">Diff</th>
                          <th className="px-4 py-2.5 text-left text-2xs font-semibold text-slate-500 uppercase">Reason</th>
                          <th className="px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => {
                          const diff = item.countedStock - item.systemStock;
                          return (
                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{item.productName}</td>
                              <td className="px-4 py-2.5 text-sm text-center text-slate-500">{item.systemStock}</td>
                              <td className="px-4 py-2.5">
                                <input type="number" value={item.countedStock} onChange={e => updateCounted(idx, e.target.value)}
                                  onKeyDown={(e) => ['.', 'e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                  min="0" step="1" className="no-spinner w-full px-3 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {diff === 0 ? (
                                  <span className="text-sm text-emerald-600 font-medium">0</span>
                                ) : (
                                  <span className={`text-sm font-semibold ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {diff > 0 ? '+' : ''}{diff}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <input type="text" value={item.reason} onChange={e => updateReason(idx, e.target.value)}
                                  placeholder="Reason" className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                              </td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={() => handleSave(false)} disabled={form.items.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 shadow-sm disabled:opacity-50"
                ><Save className="w-4 h-4" /> Save Draft</button>
                <button onClick={() => handleSave(true)} disabled={form.items.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-50"
                ><CheckCircle className="w-4 h-4" /> Save & Apply</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StockReconciliation;
