import React, { useState, useEffect } from 'react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { reportAPI } from '../../services/api';

const TrialBalanceReport = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getTrialBalance(params);
        setAccounts(res.data.accounts || []);
      } catch (err) { console.error('Failed to load trial balance', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  if (loading) return <LoadingSpinner />;

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  const groups = [
    { name: 'Assets', type: 'asset', accounts: accounts.filter(a => a.type === 'asset') },
    { name: 'Liabilities', type: 'liability', accounts: accounts.filter(a => a.type === 'liability') },
    { name: 'Equity', type: 'equity', accounts: accounts.filter(a => a.type === 'equity') },
    { name: 'Income', type: 'income', accounts: accounts.filter(a => a.type === 'income') },
    { name: 'Expenses', type: 'expense', accounts: accounts.filter(a => a.type === 'expense') },
  ].filter(g => g.accounts.length > 0);

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Trial Balance" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-[#64748B]">Total Debit</p>
            <p className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">₹{totalDebit.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-[#64748B]">Total Credit</p>
            <p className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">₹{totalCredit.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-[#64748B]">Difference</p>
            <p className={`text-lg font-bold ${totalDebit === totalCredit ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`}>
              ₹{Math.abs(totalDebit - totalCredit).toLocaleString()}
              {totalDebit === totalCredit ? ' ✓ Balanced' : ''}
            </p>
          </div>
        </div>
        {accounts.length === 0 ? (
          <EmptyState title="No Trial Balance Data" description="Trial balance will appear once you have transactions." />
        ) : (
          <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
                {accounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                    <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-[#F8FAFC]">
                      <span className="text-xs text-gray-400 dark:text-[#64748B] mr-2">{acc.code}</span>
                      {acc.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-gray-700 dark:text-[#E2E8F0]">{acc.debit > 0 ? `₹${acc.debit.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-gray-700 dark:text-[#E2E8F0]">{acc.credit > 0 ? `₹${acc.credit.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-700 dark:text-[#E2E8F0]">₹{acc.balance.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 dark:bg-[#111827] font-bold border-t-2 border-gray-300 dark:border-[#334155]">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-[#F8FAFC]">Total</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-[#F8FAFC]">₹{totalDebit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-[#F8FAFC]">₹{totalCredit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-[#F8FAFC]">₹{(totalDebit - totalCredit).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalanceReport;
