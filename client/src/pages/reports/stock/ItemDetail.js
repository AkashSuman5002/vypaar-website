import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import StockHeader from './StockHeader';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { reportAPI } from '../../../services/api';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'itemName', label: 'Item Name', width: 'w-[180px]' },
  { key: 'itemCode', label: 'Item Code', width: 'w-[130px]' },
  { key: 'hsn', label: 'HSN', width: 'w-[110px]' },
  { key: 'unit', label: 'Unit', width: 'w-[70px]' },
  { key: 'purchaseRate', label: 'Purchase Rate', width: 'w-[120px]', align: 'right' },
  { key: 'saleRate', label: 'Sale Rate', width: 'w-[120px]', align: 'right' },
  { key: 'currentStock', label: 'Current Stock', width: 'w-[120px]', align: 'right' },
  { key: 'stockValue', label: 'Stock Value', width: 'w-[120px]', align: 'right' },
];

const ItemDetail = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (search) params.search = search;
        const res = await reportAPI.getItemDetail(params);
        setData(res.data.entries || []);
      } catch (err) {
        console.error('Failed to load item details', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [search]);

  const totalStockValue = data.reduce((s, d) => s + (d.stockValue || 0), 0);
  const totalItems = data.length;

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <StockHeader title="Item Detail" search={search} onSearchChange={setSearch} />

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
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.itemName}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.itemCode}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.hsn}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.unit}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.purchaseRate || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.saleRate || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{item.currentStock}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.stockValue || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155]">
                  <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">Total</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{totalStockValue.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-[#334155] px-4 py-2.5 flex items-center justify-between text-xs">
        <div><span className="text-gray-500 dark:text-[#64748B]">Total Stock Value: </span><span className="font-semibold" style={{ color: '#22C55E' }}>₹{totalStockValue.toLocaleString()}</span></div>
        <div><span className="text-gray-500 dark:text-[#64748B]">Total Items: </span><span className="font-semibold text-gray-700 dark:text-[#E2E8F0]">{totalItems}</span></div>
      </div>
    </div>
  );
};

export default ItemDetail;
