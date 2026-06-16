import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { Plus, Warehouse, X, Pencil, Trash2, Loader2, Search, MapPin, Phone, Building2, User, Package, ChevronDown, ChevronRight, IndianRupee, Box } from 'lucide-react';
import { godownAPI, productAPI } from '../services/api';
import { formatCurrency } from '../utils/format';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

const Godowns = () => {
  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedGodown, setExpandedGodown] = useState(null);
  const [godownProducts, setGodownProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productDropdown, setProductDropdown] = useState([]);
  const [addingProductId, setAddingProductId] = useState(null);

  const emptyForm = { name: '', code: '', address: '', city: '', state: '', phone: '', email: '', managerName: '', capacity: 0, notes: '' };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gRes, pRes] = await Promise.all([
        godownAPI.getAll(),
        productAPI.getAll({ limit: 1000 }),
      ]);
      setGodowns(Array.isArray(gRes.data) ? gRes.data : gRes.data?.data || []);
      setProducts(Array.isArray(pRes.data) ? pRes.data : pRes.data?.data || []);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const loadGodownProducts = useCallback(async (godownId) => {
    setProductsLoading(true);
    try {
      const res = await productAPI.getAll({ warehouse: godownId, limit: 500 });
      setGodownProducts(res.data?.data || []);
    } catch (err) { toast.error('Failed to load products'); setGodownProducts([]); }
    setProductsLoading(false);
  }, []);

  const toggleExpand = (godownId) => {
    if (expandedGodown === godownId) {
      setExpandedGodown(null);
      setGodownProducts([]);
    } else {
      setExpandedGodown(godownId);
      loadGodownProducts(godownId);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Godown name is required');
    try {
      if (editing) {
        await godownAPI.update(editing._id, form);
        toast.success('Godown updated');
      } else {
        await godownAPI.create(form);
        toast.success('Godown created');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save godown'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this godown? Products assigned to it will lose their warehouse reference.')) return;
    try {
      await godownAPI.delete(id);
      toast.success('Godown deleted');
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const handleAddProductSearch = useCallback(async (q) => {
    if (!q || q.length < 1) { setProductDropdown([]); return; }
    try {
      const { data } = await productAPI.getAll({ search: q, limit: 20 });
      setProductDropdown(data?.data || []);
    } catch { setProductDropdown([]); }
  }, []);

  useEffect(() => { handleAddProductSearch(productSearch); }, [productSearch, handleAddProductSearch]);

  const assignProductToGodown = async (product) => {
    setAddingProductId(product._id);
    try {
      await productAPI.update(product._id, { ...product, warehouse: expandedGodown });
      toast.success(`${product.name} assigned to godown`);
      setProductSearch('');
      setProductDropdown([]);
      setShowAddProduct(false);
      loadGodownProducts(expandedGodown);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign product'); }
    setAddingProductId(null);
  };

  const removeProductFromGodown = async (product) => {
    if (!window.confirm(`Remove ${product.name} from this godown?`)) return;
    try {
      await productAPI.update(product._id, { ...product, warehouse: '' });
      toast.success(`${product.name} removed from godown`);
      loadGodownProducts(expandedGodown);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove product'); }
  };

  const filtered = godowns.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.code?.toLowerCase().includes(search.toLowerCase()) ||
    g.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Godowns</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage warehouses and view items in each godown</p>
        </div>
        <button onClick={() => { setShowModal(true); setForm(emptyForm); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Add Godown
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg"><Warehouse size={20} className="text-blue-600" /></div>
            <div><p className="text-sm text-gray-500">Total Godowns</p><p className="text-xl font-bold">{godowns.length}</p></div>
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg"><Building2 size={20} className="text-green-600" /></div>
            <div><p className="text-sm text-gray-500">Active</p><p className="text-xl font-bold">{godowns.filter(g => g.isActive !== false).length}</p></div>
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg"><Package size={20} className="text-amber-600" /></div>
            <div><p className="text-sm text-gray-500">Products in Selected</p><p className="text-xl font-bold">{expandedGodown ? godownProducts.length : '-'}</p></div>
          </div>
        </motion.div>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search godowns..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Manager</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Products</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">No godowns found</td></tr>
              ) : filtered.map(g => (
                <React.Fragment key={g._id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-l-2 border-transparent hover:border-blue-400 transition-colors" onClick={() => toggleExpand(g._id)}>
                    <td className="px-2 py-3">
                      {expandedGodown === g._id ? <ChevronDown size={16} className="text-blue-500" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-semibold mr-2">[View Items]</span>
                      {g.name}{g.isDefault ? <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span> : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.code || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.city || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.managerName || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.phone || '-'}</td>
                    <td className="px-4 py-3">{g.productCount || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${g.isActive !== false ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {g.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleExpand(g._id)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-500/10">
                          {expandedGodown === g._id ? 'Hide' : 'Items'}
                        </button>
                        <button onClick={() => { setEditing(g); setForm({ ...emptyForm, ...g }); setShowModal(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(g._id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedGodown === g._id && (
                    <tr key={`${g._id}-items`}>
                      <td colSpan={9} className="px-6 py-4 bg-gray-50/50 dark:bg-gray-900/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Package size={16} /> Items in {g.name}
                            {productsLoading && <Loader2 size={14} className="animate-spin text-blue-500" />}
                          </h4>
                          <button onClick={() => setShowAddProduct(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <Plus size={14} /> Add Item
                          </button>
                        </div>
                        {productsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 size={20} className="animate-spin text-blue-500" />
                          </div>
                        ) : godownProducts.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No items assigned to this godown. Click "Add Item" to assign products.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-800">
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Item Name</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">SKU</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Stock</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Price</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y dark:divide-gray-700">
                                {godownProducts.map(p => (
                                  <tr key={p._id} className="hover:bg-white dark:hover:bg-gray-800">
                                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{p.name}</td>
                                    <td className="px-3 py-2 text-gray-500">{p.sku || '-'}</td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.stock || 0} {p.unit || 'pcs'}</td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatCurrency(p.price || 0)}</td>
                                    <td className="px-3 py-2">
                                      <button onClick={() => removeProductFromGodown(p)}
                                        className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold">{editing ? 'Edit Godown' : 'Add Godown'}</h3>
                <button onClick={() => { setShowModal(false); setEditing(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Code</label>
                    <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Manager Name</label>
                    <input value={form.managerName} onChange={e => setForm({ ...form, managerName: e.target.value })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity</label>
                    <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? 'Update' : 'Save'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold">Add Item to Godown</h3>
                <button onClick={() => { setShowAddProduct(false); setProductSearch(''); setProductDropdown([]); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
              </div>
              <div className="p-4">
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search products to assign..."
                    className="w-full pl-9 pr-4 py-2.5 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus />
                </div>
                {productDropdown.length === 0 && productSearch.length > 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No products found</p>
                ) : productDropdown.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Type to search products</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {productDropdown.filter(p => p.type !== 'service').map(p => (
                      <div key={p._id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">SKU: {p.sku || '-'} | Stock: {p.stock || 0} {p.unit || 'pcs'}</p>
                        </div>
                        <button onClick={() => assignProductToGodown(p)} disabled={addingProductId === p._id}
                          className="ml-2 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                          {addingProductId === p._id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Godowns;
