import React, { useState, useEffect } from 'react';
import { IndianRupee, TrendingUp, TrendingDown } from 'lucide-react';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const ProfitLossReport = () => {
  const [view, setView] = useState('vyapar');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [acctData, setAcctData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        if (view === 'vyapar') {
          const res = await reportAPI.getProfit(params);
          setData(res.data || null);
          setAcctData(null);
        } else {
          const res = await reportAPI.getProfitLoss(params);
          setAcctData(res.data || null);
          setData(null);
        }
      } catch (err) {
        console.error('Failed to load', err);
        setData(null);
        setAcctData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view, dates]);

  if (loading) return <LoadingSpinner />;

  const totalIncome = view === 'vyapar' ? (data?.totalSales ?? 0) : (acctData?.totalIncome ?? 0);
  const totalExpenses = view === 'vyapar' ? (data?.totalPurchases ?? 0) : (acctData?.totalExpense ?? 0);
  const netProfit = view === 'vyapar' ? (data?.netProfit ?? 0) : (acctData?.netProfit ?? 0);
  const hasData = totalIncome > 0 || totalExpenses > 0;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="Profit & Loss" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
          <div className="flex items-center gap-2 px-6">
          <button onClick={() => exportToExcel([{particular:'Total Income',amount:0},{particular:'Total Expenses',amount:0},{particular:'Net Profit',amount:0}], [{key:'particular',label:'Particulars'},{key:'amount',label:'Amount'}], 'Profit & Loss Report')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Excel</button>
          <button onClick={() => printReport('Profit & Loss Report', [{key:'particular',label:'Particulars'},{key:'amount',label:'Amount'}], [{particular:'Total Income',amount:totalIncome},{particular:'Total Expenses',amount:totalExpenses},{particular:'Net Profit',amount:netProfit}])} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Print</button>
          {['vyapar', 'accounting'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${view === v ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70'}`}>
              {v} View
            </button>
          ))}
        </div>
        <EmptyState icon={<IndianRupee className="w-12 h-12 text-gray-300" />} title="No Profit & Loss Data Available" subtitle="Create sales, purchases, and journal entries to see your profit and loss statement." />
      </div>
    );
  }

  const incomeAccounts = acctData?.income || [];
  const expenseAccounts = acctData?.expense || [];

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Profit & Loss" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
      <div className="px-6 pb-2 flex items-center gap-2">
        <button onClick={() => { const rows = view === 'vyapar' ? [{particular:'Total Sales',amount:totalIncome},{particular:'Cost of Goods Sold',amount:data?.totalCOGS||0},{particular:'Total Purchases/Expenses',amount:totalExpenses},{particular:'Net Profit/Loss',amount:netProfit}] : [...incomeAccounts.map(a=>({particular:a.name,amount:a.amount})),{particular:'Total Revenue',amount:totalIncome},...expenseAccounts.map(a=>({particular:a.name,amount:a.amount})),{particular:'Total Expenses',amount:totalExpenses},{particular:'Net Profit/Loss',amount:netProfit}]; exportToExcel(rows,[{key:'particular',label:'Particulars'},{key:'amount',label:'Amount'}],'Profit & Loss Report'); }} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Excel</button>
        <button onClick={() => { const rows = view === 'vyapar' ? [{particular:'Total Sales',amount:totalIncome},{particular:'Cost of Goods Sold',amount:data?.totalCOGS||0},{particular:'Total Purchases/Expenses',amount:totalExpenses},{particular:'Net Profit/Loss',amount:netProfit}] : [...incomeAccounts.map(a=>({particular:a.name,amount:a.amount})),{particular:'Total Revenue',amount:totalIncome},...expenseAccounts.map(a=>({particular:a.name,amount:a.amount})),{particular:'Total Expenses',amount:totalExpenses},{particular:'Net Profit/Loss',amount:netProfit}]; printReport('Profit & Loss Report',[{key:'particular',label:'Particulars'},{key:'amount',label:'Amount'}],rows); }} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Print</button>
        {['vyapar', 'accounting'].map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${view === v ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70'}`}>
            {v} View
          </button>
        ))}
      </div>
      <div className="p-6 pt-3 space-y-5">
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
            <div className="w-10 h-10 bg-green-50 dark:bg-[#10B981]/10 rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]"><TrendingUp className="w-5 h-5 text-green-600 dark:text-[#10B981]" /></div>
            <div><p className="text-xs text-gray-500 dark:text-[#64748B]">Total Income</p><p className="text-base font-bold text-green-600 dark:text-[#10B981] mt-0.5">₹{totalIncome.toLocaleString()}</p></div>
          </div>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
            <div className="w-10 h-10 bg-red-50 dark:bg-[#EF4444]/10 rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]"><TrendingDown className="w-5 h-5 text-red-600 dark:text-[#EF4444]" /></div>
            <div><p className="text-xs text-gray-500 dark:text-[#64748B]">Total Expenses</p><p className="text-base font-bold text-red-600 dark:text-[#EF4444] mt-0.5">₹{totalExpenses.toLocaleString()}</p></div>
          </div>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center gap-3 flex-1 min-w-[160px]">
            <div className={`w-10 h-10 ${netProfit >= 0 ? 'bg-green-50 dark:bg-[#10B981]/10' : 'bg-red-50 dark:bg-[#EF4444]/10'} rounded-lg flex items-center justify-center border border-gray-200 dark:border-[#334155]`}><IndianRupee className={`w-5 h-5 ${netProfit >= 0 ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`} /></div>
            <div><p className="text-xs text-gray-500 dark:text-[#64748B]">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p><p className={`text-base font-bold mt-0.5 ${netProfit >= 0 ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`}>₹{Math.abs(netProfit).toLocaleString()}</p></div>
          </div>
        </div>

        {view === 'vyapar' ? (
          <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Particulars</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
                <tr className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-[#F8FAFC]">Total Sales</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-[#10B981]">₹{totalIncome.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#94A3B8]">Cost of Goods Sold</td>
                  <td className="px-4 py-3 text-right text-sm text-red-600 dark:text-[#EF4444]">-₹{(data?.totalCOGS ?? 0).toLocaleString()}</td>
                </tr>
                <tr className="bg-gray-50/30 dark:bg-[#1E293B]/30">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-[#F8FAFC]">Gross Profit</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800 dark:text-[#F8FAFC]">₹{(data?.grossProfit ?? 0).toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#94A3B8]">Total Purchases / Expenses</td>
                  <td className="px-4 py-3 text-right text-sm text-red-600 dark:text-[#EF4444]">-₹{totalExpenses.toLocaleString()}</td>
                </tr>
                <tr className="bg-gray-100 dark:bg-[#111827] border-t-2 border-gray-300 dark:border-[#334155]">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-[#F8FAFC]">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${netProfit >= 0 ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`}>
                    ₹{Math.abs(netProfit).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Revenue Accounts</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
                  {incomeAccounts.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[#64748B]">No revenue accounts found</td></tr>
                  ) : incomeAccounts.map((acc, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#94A3B8]">{acc.name}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-[#10B981]">₹{(acc.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/30 dark:bg-[#1E293B]/30 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-[#F8FAFC]">Total Revenue</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-600 dark:text-[#10B981]">₹{totalIncome.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Expense Accounts</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
                  {expenseAccounts.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[#64748B]">No expense accounts found</td></tr>
                  ) : expenseAccounts.map((acc, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#94A3B8]">{acc.name}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-red-600 dark:text-[#EF4444]">₹{(acc.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/30 dark:bg-[#1E293B]/30 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-[#F8FAFC]">Total Expenses</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600 dark:text-[#EF4444]">₹{totalExpenses.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-[#334155] rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-[#F8FAFC]">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
              <span className={`text-base font-bold ${netProfit >= 0 ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`}>
                ₹{Math.abs(netProfit).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitLossReport;
