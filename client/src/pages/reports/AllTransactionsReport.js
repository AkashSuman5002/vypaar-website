import React, { useState, useEffect, useMemo } from 'react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { transactionAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const typeMap = { cash_in: 'Cash In', cash_out: 'Cash Out', bank_in: 'Bank In', bank_out: 'Bank Out' };
const typeFilters = ['All', 'Cash In', 'Cash Out', 'Bank In', 'Bank Out'];
const columns = [
  { key: 'date', label: 'Date' },
  { key: 'voucher', label: 'Voucher No' },
  { key: 'type', label: 'Type', render: (v) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${v?.includes('In') ? 'bg-green-50 dark:bg-[#10B981]/10 text-green-700 dark:text-[#10B981]' : 'bg-red-50 dark:bg-[#EF4444]/10 text-red-700 dark:text-[#EF4444]'}`}>{v}</span> },
  { key: 'particular', label: 'Particulars' },
  { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AllTransactionsReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const res = await transactionAPI.getAll();
        if (!Array.isArray(res.data)) {
          setError('Unexpected response format');
          return;
        }
        const mapped = res.data.map(item => ({
          ...item,
          type: typeMap[item.type] || item.type,
          voucher: item.reference,
          particular: item.description,
        }));
        setData(mapped);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    let result = data;

    if (typeFilter !== 'All') {
      result = result.filter(r => r.type === typeFilter);
    }

    if (dates.start) {
      const start = new Date(dates.start);
      if (!isNaN(start.getTime())) {
        result = result.filter(r => {
          const d = new Date(r.date);
          return !isNaN(d.getTime()) && d >= start;
        });
      }
    }
    if (dates.end) {
      const end = new Date(dates.end);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        result = result.filter(r => {
          const d = new Date(r.date);
          return !isNaN(d.getTime()) && d <= end;
        });
      }
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        (r.particular && r.particular.toLowerCase().includes(s)) ||
        (r.description && r.description.toLowerCase().includes(s)) ||
        (r.voucher && r.voucher.toLowerCase().includes(s)) ||
        (r.reference && r.reference.toLowerCase().includes(s)) ||
        (r.type && r.type.toLowerCase().includes(s)) ||
        (r.partyName && r.partyName.toLowerCase().includes(s)) ||
        String(r.amount || '').includes(s)
      );
    }

    return result;
  }, [data, search, typeFilter, dates]);

  const totalAmount = filteredData.reduce((s, r) => s + (r.amount || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="All Transactions" onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} />
      <div className="p-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {typeFilters.map((f) => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${typeFilter === f ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70'}`}>
              {f}
            </button>
          ))}
        </div>
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">{error}</p>
            <p className="text-[#64748B] text-xs mt-2">Check that the server is running and you are logged in.</p>
          </div>
        ) : filteredData.length === 0 ? (
          <EmptyState icon={
            <svg width="110" height="80" viewBox="0 0 110 80" fill="none"><rect x="15" y="15" width="80" height="55" rx="6" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="25" y="25" width="60" height="5" rx="2.5" fill="#E5E7EB"/><rect x="25" y="34" width="25" height="3" rx="1.5" fill="#E5E7EB"/><rect x="55" y="34" width="30" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="41" width="50" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="48" width="15" height="3" rx="1.5" fill="#E5E7EB"/><rect x="45" y="48" width="35" height="3" rx="1.5" fill="#E5E7EB"/></svg>
          } title="No Transactions" description={data.length === 0 ? 'Transactions will appear here once you record them.' : 'No transactions match your filters. Try adjusting the search or date range.'} />
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={() => exportToExcel(filteredData, columns, 'All Transactions Report')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
              <button onClick={() => printReport('All Transactions Report', columns, filteredData)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
            </div>
            <ReportTable columns={columns.map(c => c.key === 'date' ? { ...c, render: (v) => formatDate(v) } : c)} data={filteredData} />
            <ReportSummary>
              <span className="text-gray-500 dark:text-[#64748B]">Total: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
            </ReportSummary>
          </>
        )}
      </div>
    </div>
  );
};

export default AllTransactionsReport;
