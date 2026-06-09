import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const summaryCards = [
  { label: 'Opening Balance', color: '#3B82F6', value: '₹0.00' },
  { label: 'Loan Amount', color: '#8B5CF6', value: '₹0.00' },
  { label: 'Interest Paid', color: '#EF4444', value: '₹0.00' },
  { label: 'Closing Balance', color: '#22C55E', value: '₹0.00' },
];

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'voucherType', label: 'Voucher Type' },
  { key: 'referenceNo', label: 'Reference Number' },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Debit', align: 'right' },
  { key: 'credit', label: 'Credit', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
];

const LoanStatement = () => {
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
        const res = await reportAPI.getLoanStatement(params);
        setData(res.data.entries || []);
      } catch (err) { console.error('Failed to load loan statement', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalDebit = data.reduce((s, d) => s + (d.debit || 0), 0);
  const totalCredit = data.reduce((s, d) => s + (d.credit || 0), 0);
  const balance = data.reduce((s, d) => s + (d.balance || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Loan Statement" description="Monitor loan accounts and repayment schedules." onDateChange={handleDateChange} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch}>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[160px]">
            <option>Select Loan Account</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
      </ReportHeader>
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <div className="grid grid-cols-4 gap-3">
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
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Debit: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalDebit.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Total Credit: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalCredit.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Balance: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{balance.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default LoanStatement;
