import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, AlertTriangle, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const gstRates = [0, 5, 12, 18, 28];

const ProductRow = ({ item, index, products, onChange, onRemove, errors }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const filtered = query
    ? products.filter(p =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.sku?.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  const selected = products.find(p => p._id === item.product);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isLowStock = selected && selected.stock !== undefined && selected.stock <= 5;
  const lineTotal = item.quantity * item.rate;
  const gstHalf = lineTotal * (item.gstRate / 100) / 2;
  const amount = lineTotal + gstHalf + gstHalf;

  return (
    <motion.tr
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group hover:bg-slate-50/40 dark:hover:bg-gray-700/20 transition-colors"
    >
      <td className="px-3 py-2">
        <div ref={ref} className="relative">
          <div
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 cursor-pointer hover:border-blue-400 transition-colors"
          >
            {selected ? (
              <>
                <div className="w-6 h-6 rounded bg-slate-100 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <Package className="w-3 h-3 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-tight">{selected.name}</p>
                  <p className="text-[10px] text-slate-400">Stock: {selected.stock ?? '-'}</p>
                </div>
              </>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-sm">Select product...</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 mt-1 left-0 right-0 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-elevated overflow-hidden"
              >
                <div className="p-2 border-b border-slate-100 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-slate-50 dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-44 overflow-y-auto scrollbar-thin p-1">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-6 text-center text-slate-400 text-xs">No products found</div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => {
                          onChange(index, { product: p._id, productName: p.name, rate: p.price, gstRate: p.gstRate || 0 });
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                          item.product === p._id
                            ? 'bg-blue-50 dark:bg-blue-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-slate-100 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">
                            <span className="font-medium text-slate-500">{formatCurrency(p.price)}</span>
                            {p.stock !== undefined && <span className="ml-2">Stock: {p.stock}</span>}
                          </p>
                        </div>
                        {item.product === p._id && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {errors?.product && <p className="text-[10px] text-red-500 mt-1">{errors.product}</p>}
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="1"
          value={item.quantity}
          onChange={(e) => onChange(index, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-16 px-2 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="1"
          value={item.rate}
          onChange={(e) => onChange(index, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
          className="w-20 px-2 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </td>

      <td className="px-3 py-2">
        <select
          value={item.gstRate}
          onChange={(e) => onChange(index, { gstRate: parseFloat(e.target.value) })}
          className="w-16 px-1 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {gstRates.map((r) => <option key={r} value={r}>{r}%</option>)}
        </select>
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="1"
          value={item.discount}
          onChange={(e) => onChange(index, { discount: Math.max(0, parseFloat(e.target.value) || 0) })}
          className="w-16 px-2 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          placeholder="0"
        />
      </td>

      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(amount - (item.discount || 0))}
          </span>
          {isLowStock && (
            <span className="group relative flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                Low stock: {selected?.stock} left
              </span>
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2 text-center">
        <button
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-all"
          title="Remove item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </motion.tr>
  );
};

const ChevronDown = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Check = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default ProductRow;
