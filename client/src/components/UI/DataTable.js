import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const DataTable = ({ columns, data, pageSize = 10, title, actions }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!search) return data;
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(search.toLowerCase());
      })
    );
  }, [data, search, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          <div className="flex items-center gap-3 ml-auto">
            {actions}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-52 pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-slate-50 dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
              {columns.map((col) => (
                <th key={col.key} className="px-5 py-3.5 text-left font-semibold text-slate-500 dark:text-slate-400 text-2xs uppercase tracking-widest">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <span className="text-sm font-medium">No results found</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your search terms</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={row._id || idx} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  currentPage === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
