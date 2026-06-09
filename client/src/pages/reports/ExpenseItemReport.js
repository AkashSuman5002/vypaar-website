import React, { useState, useEffect } from 'react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const columns = [
  { key: 'itemName', label: 'Item Name' },
  { key: 'category', label: 'Category' },
  { key: 'quantity', label: 'Quantity', align: 'right' },
  { key: 'amount', label: 'Amount', align: 'right' },
];

const ExpenseItemReport = () => {
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
        const res = await reportAPI.getExpenseItemReport(params);
        setData(res.data.entries || []);
      } catch (err) { console.error('Failed to load expense item report', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalAmount = data.reduce((s, d) => s + (d.amount || 0), 0);
  const totalQty = data.reduce((s, d) => s + (d.quantity || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Expense Item Report" description="View expenses broken down by individual items." />
      <ReportFilters search={search} onSearchChange={setSearch} period={period} onPeriodChange={setPeriod} dateStart={dates.start} dateEnd={dates.end} onDateChange={handleDateChange} />
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Quantity: <strong className="text-gray-900 dark:text-[#F8FAFC]">{totalQty}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default ExpenseItemReport;
