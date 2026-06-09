import React from 'react';

const GSTTable = ({ columns, data, footColspan, footRender }) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                style={col.width ? { minWidth: col.width, width: col.width } : {}}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                <div className="flex flex-col items-center justify-center">
                  <svg width="70" height="50" viewBox="0 0 70 50" fill="none" className="mb-2">
                    <rect x="10" y="8" width="50" height="35" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/>
                    <rect x="18" y="15" width="34" height="4" rx="2" fill="#E5E7EB"/>
                    <rect x="18" y="22" width="20" height="3" rx="1.5" fill="#E5E7EB"/>
                    <rect x="18" y="28" width="25" height="3" rx="1.5" fill="#E5E7EB"/>
                  </svg>
                  <span className="text-sm text-gray-400 dark:text-gray-500">No data available</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/60">
                {columns.map((col, j) => (
                  <td key={j} className={`px-3 py-2 text-sm text-gray-700 dark:text-gray-200 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footColspan && (
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <td colSpan={footColspan} className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                Total
              </td>
              {footRender && footRender()}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  </div>
);

export default GSTTable;
