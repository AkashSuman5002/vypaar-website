import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { INDIAN_STATES } from '../../utils/validation';

const StateDropdown = ({ value, onChange, placeholder = 'Select State', error, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return INDIAN_STATES;
    const q = query.toLowerCase();
    return INDIAN_STATES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [query]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  const selectedState = INDIAN_STATES.find(s => s.name === value);

  const handleSelect = (state) => {
    onChange(state.name);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-left flex items-center justify-between transition-colors ${
          error
            ? 'border-red-400 focus:ring-2 focus:ring-red-200'
            : 'border-slate-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
        }`}
      >
        <span className={selectedState ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
          {selectedState ? selectedState.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQuery(''); }} />
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-slate-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search states..."
                  className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>
            <div ref={listRef} className="overflow-y-auto max-h-48">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">No states found</div>
              ) : (
                filtered.map((state, idx) => (
                  <button
                    key={state.code}
                    type="button"
                    onClick={() => handleSelect(state)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                      state.name === value
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                        : highlightIdx === idx
                          ? 'bg-slate-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{state.name}</span>
                    <span className="text-xs text-slate-400">{state.code}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

export default StateDropdown;
