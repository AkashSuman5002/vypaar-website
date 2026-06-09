import React, { useState, useEffect } from 'react';
import { Plus, IndianRupee } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { purchaseAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'invoice', label: 'Invoice No' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'paid', label: 'Paid', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
];

const PurchaseReport = () => {
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
        const res = await purchaseAPI.getAll(params);
        const mapped = (res.data.purchases || []).map(item => ({
          date: item.date,
          invoice: item.invoiceNumber,
          supplier: item.supplierName,
          amount: item.totalAmount,
          paid: item.paidAmount,
          balance: item.remainingBalance,
        }));
        setData(mapped);
      } catch (err) {
        console.error('Failed to load purchase report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dates]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  const totalAmount = data.reduce((s, r) => s + (r.amount || 0), 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Purchase Report" description="Monitor all purchase transactions and supplier balances." onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} onDownload={() => exportToExcel(data, columns, 'Purchase_Report')} onPrint={printReport} />
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
            title="No Purchase Reports Yet"
            description="Purchase data will appear here once you create purchase bills."
            action={
              <button className="px-4 py-2 bg-blue-600 dark:bg-[#3B82F6] hover:bg-blue-700 dark:hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Purchase
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Purchase Report" description="Monitor all purchase transactions and supplier balances." onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} onDownload={() => exportToExcel(data, columns, 'Purchase_Report')} onPrint={printReport} />
      <div className="p-6 space-y-5">
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
            <div className="w-10 h-10 bg-blue-50 dark:bg-[#3B82F6]/10 rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]"><IndianRupee className="w-5 h-5 text-blue-600 dark:text-[#3B82F6]" /></div>
            <div><p className="text-xs text-gray-500 dark:text-[#64748B]">Total Purchases</p><p className="text-base font-bold text-gray-900 dark:text-[#F8FAFC] mt-0.5">₹{totalAmount.toLocaleString()}</p></div>
          </div>
        </div>
        <ReportTable columns={columns} data={filteredData} />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </div>
  );
};

export default PurchaseReport;
