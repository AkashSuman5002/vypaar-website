import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import StockHeader from './StockHeader';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'itemName', label: 'Item Name', width: 'w-[200px]' },
  { key: 'currentStock', label: 'Current Stock', width: 'w-[120px]', align: 'right' },
  { key: 'minStock', label: 'Minimum Stock', width: 'w-[120px]', align: 'right' },
  { key: 'shortage', label: 'Shortage', width: 'w-[110px]', align: 'right' },
  { key: 'unit', label: 'Unit', width: 'w-[80px]' },
];

const LowStockSummary = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await reportAPI.getLowStock();
        setData(res.data?.products || []);
      } catch (err) {
        console.error('Failed to load low stock data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <StockHeader title="Low Stock Summary" search={search} onSearchChange={setSearch} />

      <div className="flex-1 px-4 pb-4">
        <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  {columns.map((col) => (
                    <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                      <div className="flex items-center gap-1"><span>{col.label}</span>{col.key !== 'index' && <Filter className="w-3 h-3 text-gray-500 dark:text-[#64748B]" />}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center py-16">
                      <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="mb-4">
                        <rect x="15" y="12" width="60" height="46" rx="5" className="fill-slate-200 stroke-slate-300 dark:fill-[#1E293B] dark:stroke-[#334155]" strokeWidth="1"/>
                        <rect x="24" y="21" width="42" height="5" rx="2.5" className="fill-slate-300 dark:fill-[#334155]"/>
                        <rect x="24" y="30" width="28" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                        <rect x="24" y="37" width="35" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-[#64748B] text-center max-w-xs leading-relaxed">No data available.<br />Please try again after making relevant changes.</p>
                    </div>
                  </td></tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                      <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.name || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{item.stock ?? 0}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{item.minStock ?? 0}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{Math.max(0, (item.minStock ?? 0) - (item.stock ?? 0))}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.unit || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LowStockSummary;
