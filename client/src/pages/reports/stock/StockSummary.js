import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import StockHeader from './StockHeader';
import { productAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../../utils/exportUtils';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'itemName', label: 'Item Name', width: 'w-[160px]' },
  { key: 'unit', label: 'Unit', width: 'w-[70px]' },
  { key: 'currentStock', label: 'Current Stock', width: 'w-[120px]', align: 'right' },
  { key: 'price', label: 'Price', width: 'w-[120px]', align: 'right' },
  { key: 'costPrice', label: 'Cost Price', width: 'w-[120px]', align: 'right' },
  { key: 'stockValue', label: 'Stock Value', width: 'w-[120px]', align: 'right' },
];

const StockSummary = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await productAPI.getAll();
        setData(res.data);
      } catch (err) {
        console.error('Failed to load stock data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <StockHeader title="Stock Summary" search={search} onSearchChange={setSearch} />

      <div className="flex-1 px-4 pb-4">
        <div className="flex gap-2 mb-3">
          <button onClick={() => exportToExcel(filteredData, columns, 'Stock Summary')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
          <button onClick={() => printReport('Stock Summary', columns, filteredData)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
        </div>
        <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  {columns.map((col) => (
                    <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.key !== 'index' && <Filter className="w-3 h-3 text-gray-500 dark:text-[#64748B]" />}
                      </div>
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
                          <rect x="15" y="12" width="60" height="46" rx="5" className="fill-slate-200 stroke-slate-300 dark:fill-[#1E293B] dark:stroke-[#334155]" strokeWidth="1"/>
                          <rect x="24" y="21" width="42" height="5" rx="2.5" className="fill-slate-300 dark:fill-[#334155]"/>
                          <rect x="24" y="30" width="28" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                          <rect x="24" y="37" width="35" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                        </svg>
                        <p className="text-sm text-gray-500 dark:text-[#64748B] text-center max-w-xs leading-relaxed">
                          No data available.<br />Please try again after making relevant changes.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                      <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.name || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.unit || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{item.stock ?? 0}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.price ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.costPrice ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{((item.stock ?? 0) * (item.costPrice ?? 0)).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-[#334155] px-4 py-2.5 flex items-center justify-between text-xs">
        <div><span className="text-gray-500 dark:text-[#64748B]">Total Stock Value: </span><span className="font-semibold" style={{ color: '#22C55E' }}>₹{filteredData.reduce((s, d) => s + ((d.stock ?? 0) * (d.costPrice ?? 0)), 0).toFixed(2)}</span></div>
        <div><span className="text-gray-500 dark:text-[#64748B]">Total Items: </span><span className="font-semibold text-gray-700 dark:text-[#E2E8F0]">{filteredData.length}</span></div>
      </div>
    </div>
  );
};

export default StockSummary;
