import React from 'react';

const ReportTable = ({ columns, data, emptyState, onSort, sortKey, sortDir }) => (
  <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#111827] border-b border-[#334155]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${onSort ? 'cursor-pointer hover:text-[#94A3B8] select-none' : ''}`}
                onClick={() => onSort?.(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {onSort && sortKey === col.key && (
                    <span className="text-[#3B82F6]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E293B]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-xs text-[#64748B]">
                <div className="flex flex-col items-center gap-2">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="8" y="6" width="24" height="28" rx="4" fill="#1E293B" stroke="#334155" strokeWidth="1.5"/>
                    <rect x="13" y="12" width="14" height="2" rx="1" fill="#334155"/>
                    <rect x="13" y="16" width="10" height="2" rx="1" fill="#334155"/>
                    <rect x="13" y="20" width="12" height="2" rx="1" fill="#334155"/>
                  </svg>
                  <span>{emptyState || 'No data available'}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="hover:bg-[#1E293B]/80 transition-colors even:bg-[#1E293B]/40">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 text-xs text-[#94A3B8] ${col.align === 'right' ? 'text-right font-medium text-[#F8FAFC]' : ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default ReportTable;
