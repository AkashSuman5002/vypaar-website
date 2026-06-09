import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { productAPI, barcodeLabelAPI } from '../services/api';
import { Search, Package, Printer, Download, X, CheckSquare } from 'lucide-react';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const BarcodeLabelPrint = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await productAPI.getAll();
        setProducts(data);
      } catch {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map(p => p._id));
    }
  };

  const handlePrint = async () => {
    if (!selected.length) { toast.error('Select at least one product'); return; }
    setSubmitting(true);
    try {
      const res = await barcodeLabelAPI.generate({ productIds: selected });
      // Check if response is actually an error (content-type application/json)
      const contentType = res.headers?.['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await new Blob([res.data]).text();
        const err = JSON.parse(text);
        toast.error(err.message || 'Server error');
        return;
      }
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'barcode-labels.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let msg = err.response?.data?.message || err.message;
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try { msg = JSON.parse(text).message; } catch {}
      }
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.hsn?.includes(q);
  });

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Print Barcode Labels</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Select products and print barcode labels</p>
        </div>
        <button onClick={handlePrint} disabled={submitting || !selected.length}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
        >
          {submitting ? <LoadingSpinner /> : <Printer className="w-4 h-4" />}
          Print Labels ({selected.length})
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, SKU or HSN..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button onClick={selectAll} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700">
            <CheckSquare className="w-3.5 h-3.5" /> {selected.length === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map(product => {
          const isSelected = selected.includes(product._id);
          return (
            <button key={product._id} onClick={() => toggle(product._id)}
              className={`relative p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/30'
                  : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-gray-700 mb-2">
                <Package className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{product.name}</p>
              {product.sku && <p className="text-[10px] text-slate-400 truncate">SKU: {product.sku}</p>}
              <p className="text-xs font-bold text-blue-600 mt-1">₹{(product.price || 0).toFixed(0)}</p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">No products found</div>
        )}
      </div>
    </motion.div>
  );
};

export default BarcodeLabelPrint;
