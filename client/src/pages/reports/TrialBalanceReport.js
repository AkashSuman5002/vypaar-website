import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { reportAPI } from '../../services/api';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const amt = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v > 0.005 ? `₹${v.toLocaleString('en-IN')}` : '—';
};

// One row of the grouped trial balance. Parent rows (with children) are collapsible.
const TreeRow = ({ node, depth = 0 }) => {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [open, setOpen] = useState(depth < 2);
  return (
    <>
      <div
        className={`grid grid-cols-[1fr_140px_140px] items-center border-b border-gray-100 dark:border-[#334155]/40 ${
          depth === 0 ? 'bg-gray-50 dark:bg-[#111827] font-semibold' : ''
        } ${hasChildren ? 'cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-[#1E293B]/40' : ''}`}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5 py-2.5 text-sm text-gray-700 dark:text-[#E2E8F0]" style={{ paddingLeft: 16 + depth * 22 }}>
          {hasChildren ? (
            open ? <ChevronDown className="w-4 h-4 text-gray-400 dark:text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#64748B]" />
          ) : (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-[#475569] mx-1" />
          )}
          {node.name}
        </span>
        <span className={`px-4 py-2.5 text-right text-sm tabular-nums ${depth === 0 ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-[#F8FAFC]`}>{amt(node.debit)}</span>
        <span className={`px-4 py-2.5 text-right text-sm tabular-nums ${depth === 0 ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-[#F8FAFC]`}>{amt(node.credit)}</span>
      </div>
      {hasChildren && open && node.children.map((c, i) => <TreeRow key={i} node={c} depth={depth + 1} />)}
    </>
  );
};

// Flatten the grouped tree into indented rows for Excel / Print export.
const flattenForExport = (groups) => {
  const out = [];
  const walk = (n, d) => {
    out.push({ account: `${'    '.repeat(d)}${n.name}`, debit: n.debit || 0, credit: n.credit || 0 });
    (n.children || []).forEach((c) => walk(c, d + 1));
  };
  (groups || []).forEach((g) => walk(g, 0));
  return out;
};

const TrialBalanceReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        setError(false);
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getTrialBalance(params);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load trial balance', err);
        setError(true);
      } finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="p-6">
      <EmptyState title="Failed to Load Trial Balance" description="Something went wrong while loading the report. Please try again." />
    </div>
  );

  const groups = data?.groups || [];
  const exportCols = [
    { key: 'account', label: 'Account' },
    { key: 'debit', label: 'Debit' },
    { key: 'credit', label: 'Credit' },
  ];
  const exportRows = () => flattenForExport(groups);
  const asOnLabel = data?.asOn
    ? new Date(data.asOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Today';

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Trial Balance" onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#F8FAFC]">Trial Balance as on {asOnLabel}</h2>
            {data && (
              data.balanced
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-[#10B981] bg-green-50 dark:bg-[#10B981]/10 px-2 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-[#F59E0B] bg-amber-50 dark:bg-[#F59E0B]/10 px-2 py-1 rounded-md"><AlertTriangle className="w-3.5 h-3.5" /> Out of balance</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportToExcel(exportRows(), exportCols, 'Trial Balance')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Excel</button>
            <button onClick={() => printReport('Trial Balance', exportCols, exportRows())} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Print</button>
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState title="No Trial Balance Data" description="Trial balance will appear once you have parties, balances or transactions." />
        ) : (
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
            {/* Column header */}
            <div className="grid grid-cols-[1fr_140px_140px] bg-gray-100 dark:bg-[#0B1220] border-b border-gray-200 dark:border-[#334155]">
              <span className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Account</span>
              <span className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Debit</span>
              <span className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Credit</span>
            </div>
            {groups.map((g, i) => <TreeRow key={i} node={g} depth={0} />)}
            {/* Total row */}
            <div className="grid grid-cols-[1fr_140px_140px] bg-blue-100/60 dark:bg-[#0B1220] border-t-2 border-gray-300 dark:border-[#334155]">
              <span className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-[#F8FAFC]">Total</span>
              <span className="px-4 py-3 text-right text-base font-bold tabular-nums text-blue-700 dark:text-[#60A5FA]">{amt(data.totalDebit)}</span>
              <span className="px-4 py-3 text-right text-base font-bold tabular-nums text-blue-700 dark:text-[#60A5FA]">{amt(data.totalCredit)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalanceReport;
