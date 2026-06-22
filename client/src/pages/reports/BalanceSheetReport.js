import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { reportAPI } from '../../services/api';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const SummaryCard = ({ label, amount, trendUp = true }) => (
  <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-5 flex-1 min-w-[200px]">
    <p className="text-xs text-gray-500 dark:text-[#64748B] mb-2">{label}</p>
    <p className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC] mb-1.5">₹{(amount || 0).toLocaleString()}</p>
    <div className="flex items-center gap-1">
      {trendUp ? <TrendingUp className="w-3 h-3 text-green-600 dark:text-[#10B981]" /> : <TrendingDown className="w-3 h-3 text-red-600 dark:text-[#EF4444]" />}
      <span className={`text-xs ${trendUp ? 'text-green-600 dark:text-[#10B981]' : 'text-red-600 dark:text-[#EF4444]'}`}>
        {trendUp ? 'Positive' : 'Negative'}
      </span>
    </div>
  </div>
);

const AccountSection = ({ title, items, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
        <span className="text-sm font-semibold text-gray-700 dark:text-[#E2E8F0]">{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 dark:text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#64748B]" />}
      </button>
      {expanded && items.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-[#334155]/50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
              <span className="text-sm text-gray-600 dark:text-[#94A3B8]">{item.name}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-[#F8FAFC]">₹{(item.amount || 0).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-[#111827] font-semibold">
            <span className="text-sm text-gray-700 dark:text-[#E2E8F0]">Total {title}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-[#F8FAFC]">₹{items.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const BalanceSheetReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getBalanceSheet(params);
        setData(res.data);
      } catch (err) { console.error('Failed to load balance sheet', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Balance Sheet" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
      <div className="p-6 space-y-5">
        <div className="flex gap-2">
          <button onClick={() => { const rows = [...(data.liabilities||[]).map(i=>({name:i.name,amount:i.amount,type:'Liability'})),...(data.equity||[]).map(i=>({name:i.name,amount:i.amount,type:'Equity'})),...(data.assets||[]).map(i=>({name:i.name,amount:i.amount,type:'Asset'}))]; exportToExcel(rows,[{key:'name',label:'Account'},{key:'amount',label:'Amount'},{key:'type',label:'Type'}],'Balance Sheet'); }} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Excel</button>
          <button onClick={() => { const rows = [...(data.liabilities||[]).map(i=>({name:i.name,amount:i.amount,type:'Liability'})),...(data.equity||[]).map(i=>({name:i.name,amount:i.amount,type:'Equity'})),...(data.assets||[]).map(i=>({name:i.name,amount:i.amount,type:'Asset'}))]; printReport('Balance Sheet',[{key:'name',label:'Account'},{key:'amount',label:'Amount'},{key:'type',label:'Type'}],rows); }} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Print</button>
        </div>
        {!data ? (
          <EmptyState title="No Balance Sheet Data" description="Balance sheet data will appear once you have transactions." />
        ) : (
          <>
            <div className="flex gap-4 flex-wrap">
              <SummaryCard label="Total Assets" amount={data.totalAssets} trendUp={data.totalAssets >= (data.totalLiabilities + data.totalEquity)} />
              <SummaryCard label="Total Liabilities" amount={data.totalLiabilities} trendUp={false} />
              <SummaryCard label="Total Equity" amount={data.totalEquity} trendUp={true} />
              <SummaryCard label="Net Profit/Loss" amount={data.profitLoss || 0} trendUp={(data.profitLoss || 0) >= 0} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#E2E8F0] uppercase tracking-wider">Liabilities</h3>
                {data.liabilities?.length > 0 ? (
                  <AccountSection title="Liabilities" items={data.liabilities} />
                ) : <p className="text-sm text-gray-500 dark:text-[#64748B]">No liabilities</p>}
                {data.equity?.length > 0 && <AccountSection title="Equity" items={data.equity} />}
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#E2E8F0] uppercase tracking-wider">Assets</h3>
                {data.assets?.length > 0 ? (
                  <AccountSection title="Assets" items={data.assets} />
                ) : <p className="text-sm text-gray-500 dark:text-[#64748B]">No assets</p>}
              </div>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-[#E2E8F0]">Accounting Equation</span>
                <span className="text-sm text-gray-500 dark:text-[#64748B]">
                  Assets (₹{(data.totalAssets || 0).toLocaleString()}) = Liabilities (₹{(data.totalLiabilities || 0).toLocaleString()}) + Equity (₹{(data.totalEquity || 0).toLocaleString()})
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BalanceSheetReport;
