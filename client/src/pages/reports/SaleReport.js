import React, { useState, useEffect } from 'react';
import { Plus, IndianRupee, CheckCircle, Clock } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { saleAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const KPICard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
    <div className="w-10 h-10 bg-gray-50 dark:bg-[#0F172A] rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]">
      <Icon className={`w-5 h-5 ${color || 'text-blue-600 dark:text-[#3B82F6]'}`} />
    </div>
    <div>
      <p className="text-xs text-gray-500 dark:text-[#64748B]">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${color || 'text-gray-900 dark:text-[#F8FAFC]'}`}>{value}</p>
    </div>
  </div>
);

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'invoice', label: 'Invoice No' },
  { key: 'customer', label: 'Customer' },
  { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'received', label: 'Received', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'status', label: 'Status', render: (v) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      v === 'Paid' ? 'bg-green-50 dark:bg-[#10B981]/10 text-green-600 dark:text-[#10B981]' : v === 'Pending' ? 'bg-amber-50 dark:bg-[#F59E0B]/10 text-amber-600 dark:text-[#F59E0B]' : 'bg-red-50 dark:bg-[#EF4444]/10 text-red-600 dark:text-[#EF4444]'
    }`}>
      {v === 'Paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{v || 'Pending'}
    </span>
  )},
];

const SaleReport = () => {
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [data, setData] = useState([]);
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (dates.start) params.dateFrom = dates.start;
        if (dates.end) params.dateTo = dates.end;
        const res = await saleAPI.getAll(params);
        const mapped = (res.data.sales || []).map(item => ({
          date: item.date || item.createdAt,
          invoice: item.invoiceNumber,
          customer: item.customerName,
          amount: item.totalAmount,
          received: item.paidAmount,
          balance: item.remainingBalance,
          status: item.paymentStatus === 'paid' ? 'Paid' : item.paymentStatus === 'partial' ? 'Partial' : 'Overdue',
        }));
        setData(mapped);
      } catch (err) {
        console.error('Failed to load sale report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dates]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  const totalAmount = data.reduce((s, r) => s + (r.amount || 0), 0);
  const totalReceived = data.reduce((s, r) => s + (r.received || 0), 0);
  const totalBalance = data.reduce((s, r) => s + (r.balance || 0), 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Sale Report" description="Track all sale transactions and customer payments." onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} onDownload={() => exportToExcel(data, columns, 'Sale_Report')} onPrint={printReport} />
        <div className="p-6">
          <EmptyState
            icon={
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="10" y="8" width="36" height="28" rx="4" stroke="#E5E7EB" strokeWidth="1.5" fill="#F3F4F6"/>
                <rect x="16" y="14" width="24" height="3" rx="1.5" fill="#E5E7EB"/>
                <rect x="16" y="20" width="18" height="2" rx="1" fill="#E5E7EB"/>
                <rect x="16" y="25" width="22" height="2" rx="1" fill="#E5E7EB"/>
                <circle cx="28" cy="46" r="8" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5"/>
                <path d="M25 46h6M28 43v6" stroke="#3B82F6" strokeWidth="1.5"/>
              </svg>
            }
            title="No Sale Reports Yet"
            description="Sales data will appear here once you create invoices."
            action={
              <button className="px-4 py-2 bg-blue-600 dark:bg-[#3B82F6] hover:bg-blue-700 dark:hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Sale
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Sale Report" description="Track all sale transactions and customer payments." onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} onDownload={() => exportToExcel(data, columns, 'Sale_Report')} onPrint={printReport} />
      <div className="p-6 space-y-5">
        <div className="flex gap-4 flex-wrap">
          <KPICard icon={IndianRupee} label="Total Sales" value={`₹${totalAmount.toLocaleString()}`} color="text-blue-600 dark:text-[#3B82F6]" />
          <KPICard icon={CheckCircle} label="Received" value={`₹${totalReceived.toLocaleString()}`} color="text-green-600 dark:text-[#10B981]" />
          <KPICard icon={Clock} label="Balance" value={`₹${totalBalance.toLocaleString()}`} color="text-amber-600 dark:text-[#F59E0B]" />
        </div>
        <ReportTable columns={columns} data={filteredData} />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Received: <strong className="text-green-600 dark:text-[#10B981]">₹{totalReceived.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Balance: <strong className="text-amber-600 dark:text-[#F59E0B]">₹{totalBalance.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </div>
  );
};

export default SaleReport;
