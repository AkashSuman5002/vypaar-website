import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';

const defaultCards = [
  { label: 'Total Sales', color: '#22C55E', value: '₹0.00' },
  { label: 'Total Purchase', color: '#EF4444', value: '₹0.00' },
  { label: 'Cash Balance', color: '#F59E0B', value: '₹0.00' },
  { label: 'Total Receivable', color: '#3B82F6', value: '₹0.00' },
  { label: 'Bank Balance', color: '#8B5CF6', value: '₹0.00' },
  { label: 'Total Profit', color: '#22C55E', value: '₹0.00' },
];

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'customer', label: 'Customer' },
  { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'paid', label: 'Paid', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const fmt = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';

const BusinessStatus = () => {
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [period, setPeriod] = useState('this-month');
  const [data, setData] = useState(null);
  const filteredData = (data?.recentActivity || data?.recentTransactions || []).filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start) params.startDate = dates.start;
        if (dates.end) params.endDate = dates.end;
        const res = await dashboardAPI.getData(params);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dates]);

  const summaryCards = data
    ? [
        { label: 'Total Sales', color: '#22C55E', value: fmt(data.totalSales) },
        { label: 'Total Purchase', color: '#EF4444', value: fmt(data.totalPurchases) },
        { label: 'Cash Balance', color: '#F59E0B', value: fmt(data.cashBalance) },
        { label: 'Total Receivable', color: '#3B82F6', value: fmt(data.pendingDuesTotal) },
        { label: 'Bank Balance', color: '#8B5CF6', value: fmt(data.bankBalance) },
        { label: 'Total Profit', color: '#22C55E', value: fmt(data.netProfit) },
      ]
    : defaultCards;

  const handleDateChange = (type, value) => {
    setDates(prev => ({ ...prev, [type]: value }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <ReportHeader title="Business Status" description="Overview of your business performance metrics." />
      <ReportFilters search={search} onSearchChange={setSearch} period={period} onPeriodChange={setPeriod} dateStart={dates.start} dateEnd={dates.end} onDateChange={handleDateChange} />
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <div className="grid grid-cols-6 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-xs text-gray-500 dark:text-[#64748B]">{card.label}</span>
              </div>
              <div className="text-base font-bold" style={{ color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
        <ReportTable columns={columns} data={filteredData.map(item => ({date: item.date, invoice: item.invoiceNumber, customer: item.customerName, amount: item.totalAmount, paid: item.paidAmount}))} emptyState="No data available for Business Status" />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Sale: <strong className="text-green-600 dark:text-[#22C55E]">{data ? fmt(data.totalSales) : '₹0.00'}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Purchase: <strong className="text-gray-900 dark:text-[#F8FAFC]">{data ? fmt(data.totalPurchases) : '₹0.00'}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Cash: <strong className="text-gray-900 dark:text-[#F8FAFC]">{data ? fmt(data.cashBalance) : '₹0.00'}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Profit: <strong className="text-green-600 dark:text-[#22C55E]">{data ? fmt(data.netProfit) : '₹0.00'}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default BusinessStatus;
