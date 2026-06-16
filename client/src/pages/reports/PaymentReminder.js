import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import { exportToExcel } from '../../utils/exportUtils';

const currentYear = new Date().getFullYear();
const fyStart = new Date().getMonth() >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
const today = new Date().toISOString().split('T')[0];

const columns = [
  { key: 'partyName', label: 'Party' },
  { key: 'voucherNo', label: 'Voucher' },
  { key: 'date', label: 'Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'balance', label: 'Balance' },
  { key: 'daysOverdue', label: 'Days Overdue' },
];

const PaymentReminder = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(fyStart);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
        const res = await reportAPI.getPaymentReminders(params);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load payment reminders', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [dateFrom, dateTo]);

  if (loading) return <LoadingSpinner />;

  const allReminders = (data?.reminders || []).map(r => ({
    ...r,
    voucherNo: r.invoiceNo || r.voucherNo,
    amount: r.totalAmount || r.amount,
  }));
  const overdue = allReminders.filter(r => r.daysOverdue > 7);
  const dueSoon = allReminders.filter(r => r.daysOverdue > 0 && r.daysOverdue <= 7);
  const filteredOverdue = overdue.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const filteredDueSoon = dueSoon.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const hasData = filteredOverdue.length > 0 || filteredDueSoon.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Payment Reminders" search={search} onSearchChange={setSearch}>
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#94A3B8]">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[110px] text-xs text-gray-600 dark:text-[#94A3B8]" />
            <span className="text-gray-500 dark:text-[#64748B]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[110px] text-xs text-gray-600 dark:text-[#94A3B8]" />
          </div>
          <button onClick={() => exportToExcel(allReminders, columns, 'Payment_Reminders')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
        </ReportHeader>
        <EmptyState icon={<Bell className="w-12 h-12 text-gray-300" />} title="No Pending Payments" subtitle="All payments are up to date. Overdue and due payments will appear here." />
      </div>
    );
  }

  const renderTable = (title, items, icon, isOverdue) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-[#F8FAFC]">{title} ({items.length})</h3>
      </div>
      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Party</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Voucher</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Date</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Due Date</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Balance</th>
                {isOverdue && <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Days Overdue</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.partyName || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-[#CBD5E1]">{item.voucherNo || '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{Number(item.amount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-[#F8FAFC]">₹{Number(item.balance || 0).toLocaleString()}</td>
                  {isOverdue && <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400 font-medium">{item.daysOverdue ?? 0}d</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <ReportHeader title="Payment Reminders" search={search} onSearchChange={setSearch}>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#94A3B8]">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[110px] text-xs text-gray-600 dark:text-[#94A3B8]" />
          <span className="text-gray-500 dark:text-[#64748B]">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] rounded px-2 py-1.5 w-[110px] text-xs text-gray-600 dark:text-[#94A3B8]" />
        </div>
        <button onClick={() => exportToExcel(allReminders, columns, 'Payment_Reminders')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
        <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
      </ReportHeader>
      <div className="flex-1 px-4 pb-4">
        {filteredOverdue.length > 0 && renderTable('Overdue Payments', filteredOverdue, <AlertTriangle className="w-4 h-4 text-red-500" />, true)}
        {filteredDueSoon.length > 0 && renderTable('Due Soon (Next 7 Days)', filteredDueSoon, <Bell className="w-4 h-4 text-amber-500" />, false)}
      </div>
    </div>
  );
};

export default PaymentReminder;
