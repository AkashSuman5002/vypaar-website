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
  { key: 'voucherType', label: 'Voucher Type' },
  { key: 'voucherNo', label: 'Voucher Number' },
  { key: 'partyName', label: 'Party Name' },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Debit', align: 'right' },
  { key: 'credit', label: 'Credit', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
];

const BankStatement = () => {
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
        const res = await reportAPI.getBankStatement(params);
        setData(res.data.entries || []);
      } catch (err) { console.error('Failed to load bank statement', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const totalDebit = data.reduce((s, d) => s + (d.debit || 0), 0);
  const totalCredit = data.reduce((s, d) => s + (d.credit || 0), 0);
  const totalBalance = data.reduce((s, d) => s + (d.balance || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Bank Statement" description="Track bank transactions and account balances." onDateChange={handleDateChange} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch}>
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[160px]">
            <option>Select Bank Account</option>
            <option>HDFC Bank</option>
            <option>SBI</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
      </ReportHeader>
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total Debit: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalDebit.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Total Credit: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalCredit.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Balance: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalBalance.toLocaleString()}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default BankStatement;
