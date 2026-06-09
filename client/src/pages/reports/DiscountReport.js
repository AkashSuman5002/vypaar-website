import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'invoiceNo', label: 'Invoice No' },
  { key: 'partyName', label: 'Party Name' },
  { key: 'discountAmount', label: 'Discount Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'totalAmount', label: 'Invoice Total', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const DiscountReport = () => {
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
        const res = await reportAPI.getDiscountReport(params);
        const mapped = (res.data.entries || []).map(e => ({
          date: e.date, invoiceNo: e.invoiceNumber, partyName: e.customerName,
          discountAmount: e.discount, totalAmount: e.totalAmount,
        }));
        setData(mapped);
      } catch (err) { console.error('Failed to load discount report', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalDiscount = data.reduce((s, d) => s + (d.discountAmount || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Discount Report" description="Analyze discounts offered across parties and items." onDateChange={handleDateChange} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch}>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[130px]">
            <option>All Parties</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[130px]">
            <option>All Items</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
      </ReportHeader>
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Discount: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalDiscount.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Amount: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalDiscount.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default DiscountReport;
