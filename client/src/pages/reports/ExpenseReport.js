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
  { key: 'expenseNumber', label: 'Expense Number' },
  { key: 'category', label: 'Category' },
  { key: 'description', label: 'Description' },
  { key: 'totalAmount', label: 'Amount', align: 'right' },
];

const ExpenseReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });
  const [period, setPeriod] = useState('this-month');

  const handleDateChange = (type, value) => {
    setDates(prev => ({ ...prev, [type]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getExpenseReport(params);
        setData(res.data.entries || []);
      } catch (err) { console.error('Failed to load expense report', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalExpense = data.reduce((s, d) => s + (d.totalAmount || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Expense Report" description="Monitor and track all business expenses." />
      <ReportFilters search={search} onSearchChange={setSearch} period={period} onPeriodChange={setPeriod} dateStart={dates.start} dateEnd={dates.end} onDateChange={handleDateChange}>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[160px]">
            <option>All Categories</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
      </ReportFilters>
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Expense: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalExpense.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default ExpenseReport;
