import React, { useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
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

const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Translate a named period into a concrete { start, end } date range so the
// existing dates-driven refetch picks it up. Returns null for 'custom' (the user
// drives the date pickers manually in that mode).
const periodToRange = (period) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  switch (period) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'this-week': {
      const day = (start.getDay() + 6) % 7; // Monday-based week
      start.setDate(start.getDate() - day);
      break;
    }
    case 'this-month':
      start.setDate(1);
      break;
    case 'this-quarter': {
      const q = Math.floor(start.getMonth() / 3);
      start.setMonth(q * 3, 1);
      break;
    }
    case 'this-year':
      start.setMonth(0, 1);
      break;
    case 'custom':
    default:
      return null;
  }
  return { start: toYMD(start), end: toYMD(end) };
};

const BusinessStatus = () => {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('this-month');
  // Seed the date range from the default period so the initial load and the
  // period selector stay consistent.
  const [dates, setDates] = useState(() => periodToRange('this-month') || { start: '', end: '' });
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
    // Manually editing a date implies a custom range.
    setPeriod('custom');
    setDates(prev => ({ ...prev, [type]: value }));
  };

  // Selecting a named period computes its date range and updates `dates`, which
  // triggers the data refetch via the effect above.
  const handlePeriodChange = (value) => {
    setPeriod(value);
    const range = periodToRange(value);
    if (range) setDates(range);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <ReportHeader title="Business Status" description="Overview of your business performance metrics." />
      <div className="flex items-center justify-end gap-2 px-6 pb-2">
        <button onClick={() => {
          const table = document.querySelector('table');
          if (!table) return toast.info('No data to export');
          const rows = Array.from(table.querySelectorAll('tr'));
          const csv = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(c => `"${c.textContent.trim()}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'business-status.csv'; a.click();
          URL.revokeObjectURL(url);
          toast.success('Exported');
        }}
        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        ><Download className="w-4 h-4" /> Download</button>
        <button onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        ><Printer className="w-4 h-4" /> Print</button>
      </div>
      <ReportFilters search={search} onSearchChange={setSearch} period={period} onPeriodChange={handlePeriodChange} dateStart={dates.start} dateEnd={dates.end} onDateChange={handleDateChange} />
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
