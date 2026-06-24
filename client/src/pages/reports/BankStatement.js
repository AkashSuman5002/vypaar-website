import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import { reportAPI, bankAccountAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { toast } from 'react-toastify';

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
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState('all');
  const [dates, setDates] = useState({ start: '', end: '' });

  // The bank-statement endpoint sources rows from generic bank transactions that
  // carry no per-account identifier, so we narrow to the chosen account by matching
  // its identifying text (name / bank name / account number) against the row text.
  const matchesSelectedBank = (d) => {
    if (selectedBank === 'all') return true;
    const acc = bankAccounts.find(a => a._id === selectedBank);
    if (!acc) return true;
    const needles = [acc.name, acc.metadata?.bankName, acc.metadata?.accountNumber]
      .filter(Boolean)
      .map(s => String(s).toLowerCase());
    if (needles.length === 0) return true;
    const haystack = [d.partyName, d.description, d.voucherNo, d.voucherType]
      .map(v => String(v ?? '').toLowerCase())
      .join(' ');
    return needles.some(n => haystack.includes(n));
  };

  const filteredData = data
    .filter(matchesSelectedBank)
    .filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

  const handleDateChange = (type, value) => {
    setDates(prev => ({ ...prev, [type]: value }));
  };

  const handleDownload = () => {
    const table = document.querySelector('table');
    if (!table) return toast.info('No data to export');
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(c => `"${c.textContent.trim()}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bank-statement.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  const handlePrint = () => window.print();

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const res = await bankAccountAPI.getAll();
        setBankAccounts(res.data.accounts || []);
      } catch (err) { console.error('Failed to load bank accounts', err); }
    };
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        // Let the server narrow to the chosen account and compute that account's
        // running balance (Balance column) rather than a balance across all banks.
        if (selectedBank && selectedBank !== 'all') params.accountId = selectedBank;
        const res = await reportAPI.getBankStatement(params);
        setData(res.data.entries || []);
      } catch (err) { console.error('Failed to load bank statement', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates, selectedBank]);

  const totalDebit = filteredData.reduce((s, d) => s + (d.debit || 0), 0);
  const totalCredit = filteredData.reduce((s, d) => s + (d.credit || 0), 0);
  const totalBalance = filteredData.reduce((s, d) => s + (d.balance || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Bank Statement" description="Track bank transactions and account balances." onDateChange={handleDateChange} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} onDownload={handleDownload} onPrint={handlePrint}>
        <div className="relative">
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-900 dark:text-[#F8FAFC] cursor-pointer min-w-[160px]"
          >
            <option value="all">All Accounts</option>
            {bankAccounts.map((acc) => (
              <option key={acc._id} value={acc._id}>
                {acc.name || acc.metadata?.bankName || 'Bank Account'}
                {acc.metadata?.accountNumber ? ` - ${acc.metadata.accountNumber}` : ''}
              </option>
            ))}
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
