import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { transactionAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const KPI = ({ icon: Icon, label, value, color = 'text-gray-900 dark:text-[#F8FAFC]', bg = 'bg-blue-50 dark:bg-[#3B82F6]/10' }) => (
  <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]`}><Icon className={`w-5 h-5 ${color}`} /></div>
    <div><p className="text-xs text-gray-500 dark:text-[#64748B]">{label}</p><p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p></div>
  </div>
);

const filterBtns = ['Today', 'This Week', 'This Month', 'This Year', 'Custom'];
const columns = [
  { key: 'date', label: 'Date' },
  { key: 'voucher', label: 'Voucher No' },
  { key: 'particular', label: 'Particulars' },
  { key: 'moneyIn', label: 'Money In', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
  { key: 'moneyOut', label: 'Money Out', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
  { key: 'balance', label: 'Running Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const DayBookReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Today');
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });
  const totalIn = data.reduce((s, r) => s + (r.moneyIn || 0), 0);
  const totalOut = data.reduce((s, r) => s + (r.moneyOut || 0), 0);
  const runningBal = totalIn - totalOut;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        const now = new Date();
        if (filter === 'Today') {
          params.dateFrom = now.toISOString().split('T')[0];
          params.dateTo = now.toISOString().split('T')[0];
        } else if (filter === 'This Week') {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          params.dateFrom = start.toISOString().split('T')[0];
          params.dateTo = now.toISOString().split('T')[0];
        } else if (filter === 'This Month') {
          params.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          params.dateTo = now.toISOString().split('T')[0];
        } else if (filter === 'This Year') {
          params.dateFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          params.dateTo = now.toISOString().split('T')[0];
        } else if (filter === 'Custom' && dates.start && dates.end) {
          params.dateFrom = dates.start;
          params.dateTo = dates.end;
        }
        const res = await transactionAPI.getAll(params);
        let balance = 0;
        const processed = res.data.map(item => {
          const isIn = item.type?.includes('In') || item.amount > 0;
          const moneyIn = isIn ? Math.abs(item.amount || 0) : 0;
          const moneyOut = isIn ? 0 : Math.abs(item.amount || 0);
          balance += isIn ? moneyIn : -moneyOut;
          return {
            ...item,
            voucher: item.reference,
            particular: item.description,
            moneyIn,
            moneyOut,
            balance,
          };
        });
        setData(processed);
      } catch (err) {
        console.error('Failed to load', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filter, dates]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Day Book" onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} />
        <div className="p-6 space-y-5">
          <div className="flex gap-2 flex-wrap">
            {filterBtns.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70'}`}>
                {f}
              </button>
            ))}
          </div>
          <EmptyState icon={
            <svg width="110" height="80" viewBox="0 0 110 80" fill="none"><rect x="15" y="15" width="80" height="55" rx="6" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="25" y="25" width="60" height="5" rx="2.5" fill="#E5E7EB"/><rect x="25" y="34" width="35" height="3" rx="1.5" fill="#E5E7EB"/><rect x="65" y="34" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="41" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="50" y="41" width="35" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="50" width="55" height="2" rx="1" fill="#E5E7EB"/><rect x="25" y="56" width="55" height="2" rx="1" fill="#E5E7EB"/><circle cx="55" cy="70" r="8" fill="#E5E7EB"/><path d="M52 70h6M55 67v6" stroke="#9CA3AF" strokeWidth="1"/></svg>
          } title="No Day Book Entries" description="Day book entries will appear here once you record transactions." />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Day Book" onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} />
      <div className="p-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {filterBtns.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-4 flex-wrap">
          <KPI icon={TrendingUp} label="Money In" value={`₹${totalIn.toLocaleString()}`} color="text-green-600 dark:text-[#10B981]" bg="bg-green-50 dark:bg-[#10B981]/10" />
          <KPI icon={TrendingDown} label="Money Out" value={`₹${totalOut.toLocaleString()}`} color="text-red-600 dark:text-[#EF4444]" bg="bg-red-50 dark:bg-[#EF4444]/10" />
          <KPI icon={Wallet} label="Running Balance" value={`₹${runningBal.toLocaleString()}`} color={runningBal >= 0 ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'} bg={runningBal >= 0 ? 'bg-green-50 dark:bg-[#10B981]/10' : 'bg-red-50 dark:bg-[#EF4444]/10'} />
        </div>
        <ReportTable columns={columns} data={filteredData} />
        <ReportSummary>
          <span className="text-green-600 dark:text-[#10B981]">Money In: ₹{totalIn.toLocaleString()}</span>
          <span className="text-red-600 dark:text-[#EF4444]">Money Out: ₹{totalOut.toLocaleString()}</span>
          <span className="text-gray-900 dark:text-[#F8FAFC]">Running Balance: ₹{runningBal.toLocaleString()}</span>
        </ReportSummary>
      </div>
    </div>
  );
};

export default DayBookReport;
