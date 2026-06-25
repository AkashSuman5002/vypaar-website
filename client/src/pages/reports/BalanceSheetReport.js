import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import EmptyState from '../../components/reports/common/EmptyState';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { reportAPI } from '../../services/api';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const fmt = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}`;

// One row of the grouped tree. Parent rows (with children) are collapsible; leaf rows
// show a bullet. Depth drives the indent so the Tally/Vyapar nesting reads clearly.
const TreeRow = ({ node, depth = 0 }) => {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [open, setOpen] = useState(depth < 1);
  return (
    <>
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-[#334155]/40 ${
          depth === 0 ? 'bg-gray-50 dark:bg-[#111827] font-semibold' : ''
        } ${hasChildren ? 'cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-[#1E293B]/40' : ''}`}
        style={{ paddingLeft: 16 + depth * 22 }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-[#E2E8F0]">
          {hasChildren ? (
            open ? <ChevronDown className="w-4 h-4 text-gray-400 dark:text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#64748B]" />
          ) : (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-[#475569] mx-1" />
          )}
          {node.name}
        </span>
        <span className={`text-sm tabular-nums ${depth === 0 ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-[#F8FAFC]`}>
          {fmt(node.amount)}
        </span>
      </div>
      {hasChildren && open && node.children.map((c, i) => <TreeRow key={i} node={c} depth={depth + 1} />)}
    </>
  );
};

const Side = ({ title, groups, total, totalLabel }) => (
  <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-blue-50 dark:bg-[#0B1220] border-b border-gray-200 dark:border-[#334155]">
      <span className="text-base font-bold text-gray-800 dark:text-[#F8FAFC]">{title}</span>
    </div>
    {(groups || []).map((g, i) => <TreeRow key={i} node={g} depth={0} />)}
    <div className="flex items-center justify-between px-4 py-3 bg-blue-100/60 dark:bg-[#0B1220] border-t border-gray-200 dark:border-[#334155]">
      <span className="text-sm font-bold text-gray-800 dark:text-[#F8FAFC]">{totalLabel}</span>
      <span className="text-base font-bold tabular-nums text-blue-700 dark:text-[#60A5FA]">{fmt(total)}</span>
    </div>
  </div>
);

// Flatten the grouped tree into indented rows for Excel / Print export.
const flattenForExport = (groups, side) => {
  const out = [];
  const walk = (n, d) => {
    out.push({ account: `${'    '.repeat(d)}${n.name}`, amount: n.amount, side });
    (n.children || []).forEach((c) => walk(c, d + 1));
  };
  (groups || []).forEach((g) => walk(g, 0));
  return out;
};

const BalanceSheetReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [layout, setLayout] = useState('vertical'); // 'vertical' | 'horizontal'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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

  const groups = data?.groups;
  const hasData = groups && (groups.assets?.length || groups.liabilities?.length);

  const exportRows = () => [
    ...flattenForExport(groups?.liabilities, 'Equities & Liabilities'),
    ...flattenForExport(groups?.assets, 'Assets'),
  ];
  const exportCols = [
    { key: 'side', label: 'Section' },
    { key: 'account', label: 'Account' },
    { key: 'amount', label: 'Amount' },
  ];

  const asOnLabel = data?.asOn
    ? new Date(data.asOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Today';

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader title="Balance Sheet" onDateChange={(t, v) => setDates({ ...dates, [t]: v })} startDate={dates.start} endDate={dates.end} />
      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#F8FAFC]">Balance Sheet as on {asOnLabel}</h2>
            {data && (
              data.balanced
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-[#10B981] bg-green-50 dark:bg-[#10B981]/10 px-2 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-[#F59E0B] bg-amber-50 dark:bg-[#F59E0B]/10 px-2 py-1 rounded-md"><AlertTriangle className="w-3.5 h-3.5" /> Out of balance</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-300 dark:border-[#334155] overflow-hidden">
              <button onClick={() => setLayout('horizontal')} className={`px-3 py-1.5 text-xs font-medium ${layout === 'horizontal' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8]'}`}>Horizontal</button>
              <button onClick={() => setLayout('vertical')} className={`px-3 py-1.5 text-xs font-medium ${layout === 'vertical' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8]'}`}>Vertical</button>
            </div>
            <button onClick={() => exportToExcel(exportRows(), exportCols, 'Balance Sheet')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Excel</button>
            <button onClick={() => printReport('Balance Sheet', exportCols, exportRows())} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155]">Print</button>
          </div>
        </div>

        {!hasData ? (
          <EmptyState title="No Balance Sheet Data" description="Balance sheet data will appear once you have parties, balances or transactions." />
        ) : (
          <div className={layout === 'horizontal' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-6'}>
            <Side title="Equities & Liabilities" groups={groups.liabilities} total={data.totalLiabilities} totalLabel="Total Equities & Liabilities" />
            <Side title="Assets" groups={groups.assets} total={data.totalAssets} totalLabel="Total Assets" />
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceSheetReport;
