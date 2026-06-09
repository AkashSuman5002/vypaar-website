import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import StockHeader from './StockHeader';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { reportAPI } from '../../../services/api';

const columns = [
  { key: 'date', label: 'Date', width: 'w-[110px]' },
  { key: 'voucherType', label: 'Voucher Type', width: 'w-[130px]' },
  { key: 'voucherNo', label: 'Voucher Number', width: 'w-[140px]' },
  { key: 'partyName', label: 'Party Name', width: 'w-[160px]' },
  { key: 'warehouse', label: 'Warehouse', width: 'w-[130px]' },
  { key: 'inward', label: 'Inward Qty', width: 'w-[110px]', align: 'right' },
  { key: 'outward', label: 'Outward Qty', width: 'w-[110px]', align: 'right' },
  { key: 'balance', label: 'Balance Qty', width: 'w-[110px]', align: 'right' },
];

const StockDetail = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (debouncedSearch) params.search = debouncedSearch;
        const res = await reportAPI.getStockDetail(params);
        setData(res.data.entries || []);
      } catch (err) {
        console.error('Failed to load stock detail', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [debouncedSearch]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <StockHeader title="Stock Detail" search={search} onSearchChange={setSearch} />

      <div className="flex-1 px-4 pb-4">
        <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  {columns.map((col) => (
                    <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                      <div className="flex items-center gap-1"><span>{col.label}</span>{col.key !== 'date' && <Filter className="w-3 h-3 text-gray-500 dark:text-[#64748B]" />}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center py-16">
                      <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="mb-4">
                        <rect x="15" y="12" width="60" height="46" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
                        <rect x="24" y="21" width="42" height="5" rx="2.5" fill="#334155"/>
                        <rect x="24" y="30" width="28" height="3" rx="1.5" fill="#334155"/>
                        <rect x="24" y="37" width="35" height="3" rx="1.5" fill="#334155"/>
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-[#64748B] text-center max-w-xs leading-relaxed">No data available.<br />Please try again after making relevant changes.</p>
                    </div>
                  </td></tr>
                ) : data.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-[#334155]/50 hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.date ? new Date(item.date).toLocaleDateString('en-IN') : '-'}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.voucherType}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.voucherNo}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.partyName}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.warehouse}</td>
                    <td className="px-3 py-2.5 text-green-600 text-right">{item.inward || '-'}</td>
                    <td className="px-3 py-2.5 text-red-600 text-right">{item.outward || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{item.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
