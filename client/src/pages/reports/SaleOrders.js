import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const columns = [
  { key: 'orderNo', label: 'Order No' },
  { key: 'date', label: 'Date' },
  { key: 'partyName', label: 'Party Name' },
  { key: 'totalAmount', label: 'Total Amount', align: 'right' },
  { key: 'status', label: 'Status' },
];

const SaleOrders = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });

  const handleDateChange = (type, value) => {
    setDates(prev => ({ ...prev, [type]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getSaleOrders(params);
        setData(res.data.orders || []);
      } catch (err) { console.error('Failed to load sale orders', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalAmount = data.reduce((s, d) => s + (d.totalAmount || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Sale Orders" description="Track all sale order statuses and fulfillment." onDateChange={handleDateChange} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch}>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[140px]">
            <option>All Parties</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
      </ReportHeader>
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Orders: <strong className="text-gray-900 dark:text-[#F8FAFC]">{data.length}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Amount: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default SaleOrders;
