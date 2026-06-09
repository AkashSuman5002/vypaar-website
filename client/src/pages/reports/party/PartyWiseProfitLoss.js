import React, { useState, useEffect } from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'partyName', label: 'Party Name', width: 'w-[200px]' },
  { key: 'phone', label: 'Phone No.', width: 'w-[150px]' },
  { key: 'totalSale', label: 'Total Sale Amount', width: 'w-[160px]', align: 'right' },
  { key: 'profit', label: 'Profit (+) / Loss (-)', width: 'w-[160px]', align: 'right' },
];

const PartyWiseProfitLoss = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await reportAPI.getPartyWiseProfitLoss(params);
        setData(res.data.entries || []);
      } catch (err) {
        console.error('Failed to load party profit/loss', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  const filtered = data.filter(d => !search || d.partyName?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="p-4 bg-white dark:bg-[#0F172A] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">Party Wise Profit & Loss</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#94A3B8]">
            <span>Between</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8] rounded px-2 py-1.5 w-[120px] text-xs" />
            <span>To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8] rounded px-2 py-1.5 w-[120px] text-xs" />
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search party..." className="border border-gray-300 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8] rounded px-3 py-1.5 text-xs w-[150px]" />
          <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-white dark:bg-[#1E293B]/70"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
          <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-white dark:bg-[#1E293B]/70"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs">
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">
                  <div className="flex flex-col items-center justify-center">
                    <svg width="80" height="60" viewBox="0 0 80 60" fill="none" className="mb-3">
                      <rect x="15" y="10" width="50" height="40" rx="4" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
                      <rect x="22" y="18" width="36" height="4" rx="2" fill="#334155"/>
                      <rect x="22" y="26" width="25" height="3" rx="1.5" fill="#334155"/>
                      <rect x="22" y="32" width="30" height="3" rx="1.5" fill="#334155"/>
                    </svg>
                    <span className="text-sm text-gray-500 dark:text-[#64748B]">No data is available for Party Wise Profit &amp; Loss</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200 dark:border-[#334155]">
                  <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.partyName}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.phone}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.totalSale ?? 0).toLocaleString()}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(item.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(item.profit ?? 0) >= 0 ? '+' : ''}₹{(item.profit ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155]">
              <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">Total</td>
              <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{filtered.reduce((s, d) => s + (d.totalSale ?? 0), 0).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{filtered.reduce((s, d) => s + (d.profit ?? 0), 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default PartyWiseProfitLoss;
