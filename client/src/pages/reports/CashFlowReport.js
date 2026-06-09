import React, { useState, useEffect } from 'react';
import { IndianRupee, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { transactionAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const KPI = ({ icon: Icon, label, value, color, bg }) => (
  <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]`}><Icon className={`w-5 h-5 ${color}`} /></div>
    <div><p className="text-xs text-gray-500 dark:text-[#64748B]">{label}</p><p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p></div>
  </div>
);

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'particular', label: 'Particulars' },
  { key: 'type', label: 'Type', render: (v) => { const label = v?.includes('in') ? 'In' : 'Out'; return <span className={`px-2 py-0.5 rounded text-xs font-medium ${label === 'In' ? 'bg-green-50 dark:bg-[#10B981]/10 text-green-700 dark:text-[#10B981]' : 'bg-red-50 dark:bg-[#EF4444]/10 text-red-700 dark:text-[#EF4444]'}`}>{label}</span>; } },
  { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const CashFlowReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });
  const [cashBalance, setCashBalance] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txnRes, balRes] = await Promise.all([
          transactionAPI.getAll(),
          transactionAPI.getBalance(),
        ]);
        const mapped = (txnRes.data || []).map(item => ({
          ...item,
          particular: item.description,
        }));
        setData(mapped);
        if (balRes.data) {
          setCashBalance(balRes.data.cashBalance || 0);
        }
      } catch (err) {
        console.error('Failed to load', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openingCash = cashBalance;
  const cashIn = data.filter(r => r.type?.includes('in')).reduce((s, r) => s + (r.amount || 0), 0);
  const cashOut = data.filter(r => r.type?.includes('out')).reduce((s, r) => s + (r.amount || 0), 0);
  const closingCash = openingCash + cashIn - cashOut;

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Cash Flow" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
        <div className="p-6 space-y-5">
          <div className="flex gap-4 flex-wrap">
            <KPI icon={Wallet} label="Opening Cash" value="₹0" color="text-blue-600 dark:text-[#3B82F6]" bg="bg-blue-50 dark:bg-[#3B82F6]/10" />
            <KPI icon={TrendingUp} label="Cash In" value="₹0" color="text-green-600 dark:text-[#10B981]" bg="bg-green-50 dark:bg-[#10B981]/10" />
            <KPI icon={TrendingDown} label="Cash Out" value="₹0" color="text-red-600 dark:text-[#EF4444]" bg="bg-red-50 dark:bg-[#EF4444]/10" />
            <KPI icon={IndianRupee} label="Closing Cash" value="₹0" color="text-blue-600 dark:text-[#3B82F6]" bg="bg-blue-50 dark:bg-[#3B82F6]/10" />
          </div>
          <EmptyState icon={
            <svg width="110" height="80" viewBox="0 0 110 80" fill="none"><rect x="15" y="15" width="80" height="55" rx="6" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="25" y="25" width="60" height="5" rx="2.5" fill="#E5E7EB"/><rect x="25" y="34" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="50" y="34" width="35" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="41" width="40" height="3" rx="1.5" fill="#E5E7EB"/><rect x="25" y="48" width="55" height="2" rx="1" fill="#E5E7EB"/><rect x="25" y="54" width="55" height="2" rx="1" fill="#E5E7EB"/></svg>
          } title="No Cash Flow Data" description="Cash flow entries will appear here once you record transactions." />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Cash Flow" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} />
      <div className="p-6 space-y-5">
        <div className="flex gap-4 flex-wrap">
          <KPI icon={Wallet} label="Opening Cash" value={`₹${openingCash.toLocaleString()}`} color="text-blue-600 dark:text-[#3B82F6]" bg="bg-blue-50 dark:bg-[#3B82F6]/10" />
          <KPI icon={TrendingUp} label="Cash In" value={`₹${cashIn.toLocaleString()}`} color="text-green-600 dark:text-[#10B981]" bg="bg-green-50 dark:bg-[#10B981]/10" />
          <KPI icon={TrendingDown} label="Cash Out" value={`₹${cashOut.toLocaleString()}`} color="text-red-600 dark:text-[#EF4444]" bg="bg-red-50 dark:bg-[#EF4444]/10" />
          <KPI icon={IndianRupee} label="Closing Cash" value={`₹${closingCash.toLocaleString()}`} color="text-blue-600 dark:text-[#3B82F6]" bg="bg-blue-50 dark:bg-[#3B82F6]/10" />
        </div>
        <ReportTable columns={columns} data={filteredData} />
        <ReportSummary>
          <span className="text-blue-600 dark:text-[#3B82F6]">Opening: ₹{openingCash.toLocaleString()}</span>
          <span className="text-green-600 dark:text-[#10B981]">In: ₹{cashIn.toLocaleString()}</span>
          <span className="text-red-600 dark:text-[#EF4444]">Out: ₹{cashOut.toLocaleString()}</span>
          <span className="text-gray-900 dark:text-[#F8FAFC] font-semibold">Closing: ₹{closingCash.toLocaleString()}</span>
        </ReportSummary>
      </div>
    </div>
  );
};

export default CashFlowReport;
