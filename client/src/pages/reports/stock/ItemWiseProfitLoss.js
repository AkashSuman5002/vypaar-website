import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import StockHeader from './StockHeader';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { reportAPI } from '../../../services/api';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'itemName', label: 'Item Name', width: 'w-[180px]' },
  { key: 'purchaseAmount', label: 'Purchase Amount', width: 'w-[150px]', align: 'right' },
  { key: 'saleAmount', label: 'Sale Amount', width: 'w-[150px]', align: 'right' },
  { key: 'profit', label: 'Profit', width: 'w-[130px]', align: 'right' },
  { key: 'profitPct', label: 'Profit %', width: 'w-[100px]', align: 'right' },
];

const fmt = (v) => v == null || isNaN(v) ? '₹0' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtPct = (v) => v == null || isNaN(v) ? '0%' : Number(v) + '%';

const ItemWiseProfitLoss = () => {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ purchaseAmount: 0, saleAmount: 0, profit: 0, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await reportAPI.getItemWiseProfitLoss({ search });
        setData(res.data.entries || []);
        setTotals(res.data);
      } catch (err) {
        console.error('Failed to load item wise profit loss', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [search]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <StockHeader title="Item Wise Profit And Loss" search={search} onSearchChange={setSearch} />

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
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{fmt(item.purchaseAmount)}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">{fmt(item.saleAmount)}</td>
                    <td className={`px-3 py-2.5 text-right ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(item.profit)}</td>
                    <td className={`px-3 py-2.5 text-right ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(item.profitPct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155]">
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">Grand Profit</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">{fmt(totals.purchaseAmount)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">{fmt(totals.saleAmount)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">{fmt(totals.profit)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">{totals.purchaseAmount > 0 ? fmtPct(Math.round((totals.profit / totals.purchaseAmount) * 100)) : '0%'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemWiseProfitLoss;
