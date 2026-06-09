import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Check, Phone, Mail, ChevronDown } from 'lucide-react';

const CustomerSearch = ({ customers = [], value, onChange, onCreateNew }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const filtered = query
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.phone?.includes(query) ||
        c.email?.toLowerCase().includes(query.toLowerCase())
      )
    : customers;

  const selected = customers.find(c => c._id === value);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Customer</label>
      <div
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm cursor-pointer flex items-center justify-between hover:border-blue-400 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
              {selected.name?.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{selected.name}</p>
              {selected.phone && <p className="text-[10px] text-slate-400 dark:text-slate-500">{selected.phone}</p>}
            </div>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">Search or select customer...</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-elevated overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, phone or email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-slate-50 dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto scrollbar-thin p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-slate-400 dark:text-slate-500 text-xs">No customers found</div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { onChange(c._id); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                      value === c._id
                        ? 'bg-blue-50 dark:bg-blue-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      </div>
                    </div>
                    {value === c._id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-slate-100 dark:border-gray-700">
              <button
                onClick={() => { onCreateNew?.(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
              >
                <Plus className="w-4 h-4" /> New Customer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerSearch;
