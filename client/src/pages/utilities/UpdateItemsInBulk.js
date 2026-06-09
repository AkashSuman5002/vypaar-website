import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Search, IndianRupee, RefreshCw } from 'lucide-react';
import { productAPI } from '../../services/api';

const TAX_TYPES = ['Included', 'Excluded'];
const DISCOUNT_TYPES = ['Percentage', 'Value'];
const TAX_RATES = ['None', '0%', '5%', '12%', '18%', '28%'];

const UpdateItemsInBulk = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pricing');
  const [selectedItems, setSelectedItems] = useState([]);
  const [updates, setUpdates] = useState({});
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productAPI.getAll();
      setProducts(res.data.products || res.data || []);
    } catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.hsn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    setSelectedItems(prev => prev.length === filteredProducts.length ? [] : filteredProducts.map(p => p._id));
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleUpdateField = (itemId, field, value) => {
    setUpdates(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [field]: value } }));
  };

  const handleBulkUpdate = async () => {
    if (selectedItems.length === 0) { toast.error('Please select items to update'); return; }
    const toUpdate = selectedItems.filter(id => updates[id] && Object.keys(updates[id]).length > 0);
    if (toUpdate.length === 0) { toast.error('No changes to update'); return; }
    setSaving(true);
    try {
      await Promise.all(toUpdate.map(id => productAPI.update(id, updates[id])));
      toast.success(`Updated ${toUpdate.length} items successfully!`);
      setSelectedItems([]); setUpdates({});
      loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const tabs = [{ id: 'pricing', label: 'Pricing' }, { id: 'stock', label: 'Stock' }, { id: 'itemInfo', label: 'Item Information' }];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Bulk Update Items</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64" placeholder="Search by item name / HSN Code" />
          </div>
          {tabs.map(tab => (
            <label key={tab.id} className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="radio" name="tab" checked={activeTab === tab.id} onChange={() => setActiveTab(tab.id)} className="w-4 h-4 text-blue-600 border-slate-300" />
              {tab.label}
            </label>
          ))}
        </div>
      </div>
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-6 py-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-blue-700 font-medium">{selectedItems.length} items selected</span>
        <button onClick={handleBulkUpdate} disabled={selectedItems.length === 0 || saving} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} /> {saving ? 'Updating...' : 'Update'}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left w-10"><input type="checkbox" checked={selectedItems.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">ITEM NAME</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">CATEGORY</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">HSN</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">PURCHASE PRICE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">TAX TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">SALE PRICE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">TAX TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">DISCOUNT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">DISC. TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">TAX RATE</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" className="px-6 py-12 text-center text-sm text-slate-400">Loading items...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan="12" className="px-6 py-12 text-center text-sm text-slate-400">No items found</td></tr>
              ) : filteredProducts.map((product, idx) => {
                const u = updates[product._id] || {};
                return (
                  <tr key={product._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedItems.includes(product._id)} onChange={() => toggleSelectItem(product._id)} className="rounded border-slate-300" /></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[150px] truncate">{product.name}</td>
                    <td className="px-4 py-3"><select value={u.category || product.category || ''} onChange={(e) => handleUpdateField(product._id, 'category', e.target.value)} className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"><option value="">---</option><option value="Electronics">Electronics</option><option value="Fashion">Fashion</option><option value="Groceries">Groceries</option><option value="Other">Other</option></select></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{product.hsn || '---'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IndianRupee className="w-3 h-3 text-slate-400" /><input type="number" value={u.purchasePrice ?? product.purchasePrice ?? ''} onChange={(e) => handleUpdateField(product._id, 'purchasePrice', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></div></td>
                    <td className="px-4 py-3"><select value={u.purchaseTaxType || 'Excluded'} onChange={(e) => handleUpdateField(product._id, 'purchaseTaxType', e.target.value)} className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IndianRupee className="w-3 h-3 text-slate-400" /><input type="number" value={u.salePrice ?? product.salePrice ?? ''} onChange={(e) => handleUpdateField(product._id, 'salePrice', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></div></td>
                    <td className="px-4 py-3"><select value={u.saleTaxType || 'Excluded'} onChange={(e) => handleUpdateField(product._id, 'saleTaxType', e.target.value)} className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><input type="number" value={u.discount ?? product.discount ?? ''} onChange={(e) => handleUpdateField(product._id, 'discount', e.target.value)} className="w-16 px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></td>
                    <td className="px-4 py-3"><select value={u.discountType || 'Percentage'} onChange={(e) => handleUpdateField(product._id, 'discountType', e.target.value)} className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">{DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><select value={u.taxRate || 'None'} onChange={(e) => handleUpdateField(product._id, 'taxRate', e.target.value)} className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_RATES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end items-center mt-4">
        <button onClick={handleBulkUpdate} disabled={selectedItems.length === 0 || saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Updating...' : 'Update'}</button>
      </div>
    </motion.div>
  );
};

export default UpdateItemsInBulk;
