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
      setProducts(res.data?.data || []);
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">Bulk Update Items</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-sm text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64" placeholder="Search by item name / HSN Code" />
          </div>
          {tabs.map(tab => (
            <label key={tab.id} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-[#94A3B8] cursor-pointer">
              <input type="radio" name="tab" checked={activeTab === tab.id} onChange={() => setActiveTab(tab.id)} className="w-4 h-4 text-blue-600 border-slate-300 dark:border-[#334155]" />
              {tab.label}
            </label>
          ))}
        </div>
      </div>
      <div className="bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl px-6 py-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">{selectedItems.length} items selected</span>
        <button onClick={handleBulkUpdate} disabled={selectedItems.length === 0 || saving} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} /> {saving ? 'Updating...' : 'Update'}
        </button>
      </div>
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#334155]">
              <th className="px-4 py-3 text-left w-10"><input type="checkbox" checked={selectedItems.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 dark:border-[#334155]" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">ITEM NAME</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">CATEGORY</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">HSN</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">PURCHASE PRICE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">TAX TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">SALE PRICE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">TAX TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">DISCOUNT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">DISC. TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">TAX RATE</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">Loading items...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan="12" className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">No items found</td></tr>
              ) : filteredProducts.map((product, idx) => {
                const u = updates[product._id] || {};
                return (
                  <tr key={product._id} className="border-b border-slate-100 dark:border-[#334155] hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/70 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedItems.includes(product._id)} onChange={() => toggleSelectItem(product._id)} className="rounded border-slate-300 dark:border-[#334155]" /></td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-[#F8FAFC] max-w-[150px] truncate">{product.name}</td>
                    <td className="px-4 py-3"><select value={u.category || product.category || ''} onChange={(e) => handleUpdateField(product._id, 'category', e.target.value)} className="px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"><option value="">---</option><option value="Electronics">Electronics</option><option value="Fashion">Fashion</option><option value="Groceries">Groceries</option><option value="Other">Other</option></select></td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{product.hsn || '---'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IndianRupee className="w-3 h-3 text-slate-400 dark:text-[#64748B]" /><input type="number" value={u.purchasePrice ?? product.purchasePrice ?? ''} onChange={(e) => handleUpdateField(product._id, 'purchasePrice', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></div></td>
                    <td className="px-4 py-3"><select value={u.purchaseTaxType || 'Excluded'} onChange={(e) => handleUpdateField(product._id, 'purchaseTaxType', e.target.value)} className="px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IndianRupee className="w-3 h-3 text-slate-400 dark:text-[#64748B]" /><input type="number" value={u.salePrice ?? product.salePrice ?? ''} onChange={(e) => handleUpdateField(product._id, 'salePrice', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></div></td>
                    <td className="px-4 py-3"><select value={u.saleTaxType || 'Excluded'} onChange={(e) => handleUpdateField(product._id, 'saleTaxType', e.target.value)} className="px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><input type="number" value={u.discount ?? product.discount ?? ''} onChange={(e) => handleUpdateField(product._id, 'discount', e.target.value)} className="w-16 px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="---" /></td>
                    <td className="px-4 py-3"><select value={u.discountType || 'Percentage'} onChange={(e) => handleUpdateField(product._id, 'discountType', e.target.value)} className="px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500">{DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-4 py-3"><select value={u.taxRate || 'None'} onChange={(e) => handleUpdateField(product._id, 'taxRate', e.target.value)} className="px-2 py-1 border border-slate-200 dark:border-[#334155] rounded bg-white dark:bg-[#1E293B] text-sm text-slate-700 dark:text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500">{TAX_RATES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
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
