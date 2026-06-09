import React, { useState, useEffect } from 'react';
import { ChevronDown, Search, Download, Printer } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'collectorName', label: 'Collector Name', width: 'w-[170px]' },
  { key: 'tan', label: 'TAN', width: 'w-[130px]' },
  { key: 'partyName', label: 'Party Name', width: 'w-[170px]' },
  { key: 'pan', label: 'PAN', width: 'w-[130px]' },
  { key: 'transactionAmount', label: 'Transaction Amount', width: 'w-[160px]', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'tcsPct', label: 'TCS %', width: 'w-[100px]', align: 'right', render: (v) => `${(v||0)}%` },
  { key: 'tcsAmount', label: 'TCS Amount', width: 'w-[130px]', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
];

const Form27EQ = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await reportAPI.getForm27EQ();
        setData(res.data.sections || []);
      } catch (err) { console.error('Failed to load Form 27EQ', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const totalTransaction = data.reduce((s, d) => s + (d.transactionAmount || 0), 0);
  const totalTCS = data.reduce((s, d) => s + (d.tcsAmount || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-200 dark:border-[#334155]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-sm text-gray-600 dark:text-[#94A3B8] min-w-[130px] cursor-pointer">
              <option>This Month</option>
              <option>Today</option>
              <option>Yesterday</option>
              <option>This Week</option>
              <option>This Quarter</option>
              <option>This Year</option>
              <option>Custom</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B] pointer-events-none" />
          </div>
          <span className="text-xs text-gray-500 dark:text-[#64748B]">Between</span>
          <input type="date" className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[120px] text-xs text-gray-600 dark:text-[#94A3B8]" />
          <span className="text-xs text-gray-500 dark:text-[#64748B]">To</span>
          <input type="date" className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[120px] text-xs text-gray-600 dark:text-[#94A3B8]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-[#94A3B8] min-w-[130px] cursor-pointer">
              <option>ALL FIRMS</option>
              <option>My Company</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
          </div>
          <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-[#1E293B]/70"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
          <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-[#1E293B]/70"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="relative w-[250px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded text-xs text-gray-600 dark:text-[#94A3B8] placeholder-gray-500 dark:placeholder-[#64748B]" />
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  {columns.map((col) => (
                    <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="flex flex-col items-center justify-center py-16">
                        <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="mb-4">
                          <rect x="15" y="12" width="60" height="46" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
                          <rect x="24" y="21" width="42" height="5" rx="2.5" fill="#334155"/>
                          <rect x="24" y="30" width="28" height="3" rx="1.5" fill="#334155"/>
                          <rect x="24" y="37" width="35" height="3" rx="1.5" fill="#334155"/>
                        </svg>
                        <p className="text-sm text-gray-500 dark:text-[#64748B] text-center max-w-xs leading-relaxed">No data available.<br />Please try again after making relevant changes.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                      {columns.map((col) => (
                        <td key={col.key} className={`px-3 py-2 text-sm text-gray-700 dark:text-[#E2E8F0] ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155]">
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">Total</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{totalTransaction.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right" />
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{totalTCS.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form27EQ;
