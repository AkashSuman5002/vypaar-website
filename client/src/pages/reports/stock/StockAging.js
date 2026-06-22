import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import ReportHeader from '../../../components/reports/common/ReportHeader';
import EmptyState from '../../../components/reports/common/EmptyState';
import { toast } from 'react-toastify';

const StockAging = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getStockAging(params);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load stock aging', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [dates]);

  if (loading) return <LoadingSpinner />;

  const handleDownload = () => {
    const table = document.querySelector('table');
    if (!table) return toast.info('No data to export');
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(c => `"${c.textContent.trim()}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stock-aging.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  const handlePrint = () => window.print();

  const agingData = data?.aging || {};
  const buckets = [];
  const productMap = {};
  for (const [bucket, items] of Object.entries(agingData)) {
    for (const item of items) {
      if (!productMap[item._id]) {
        productMap[item._id] = { _id: item._id, name: item.name, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
        buckets.push(productMap[item._id]);
      }
      productMap[item._id][bucket] = item.stock;
      productMap[item._id].total += item.stock;
    }
  }
  const filteredBuckets = buckets.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const hasData = filteredBuckets.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Stock Aging" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} onDownload={handleDownload} onPrint={handlePrint} />
        <EmptyState icon={<Clock className="w-12 h-12 text-gray-300" />} title="No Stock Aging Data" subtitle="Stock with purchase history will appear here based on their age." />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <ReportHeader title="Stock Aging" search={search} onSearchChange={setSearch} onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} onDownload={handleDownload} onPrint={handlePrint} />
      <div className="flex-1 px-4 pb-4">
        <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Item</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">0-30 Days</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">31-60 Days</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">61-90 Days</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">90+ Days</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Total Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuckets.map((item, idx) => (
                  <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                    <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.name || '-'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item['0-30'] ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item['31-60'] ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item['61-90'] ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item['90+'] ?? 0}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-[#F8FAFC]">{item.total ?? 0}</td>
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

export default StockAging;
