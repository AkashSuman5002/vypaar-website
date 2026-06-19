import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Printer, Download } from 'lucide-react';
import { reportAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ReportHeader from '../../components/reports/common/ReportHeader';
import { printReport } from '../../utils/exportUtils';

const ACCENT = { green: 'text-green-600 dark:text-[#10B981]', red: 'text-red-600 dark:text-[#EF4444]' };
const fmt = (n) => `₹${Math.abs(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AccountNode = ({ node, depth = 0, collapseKey }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  // Reset open state when collapseKey changes
  useEffect(() => {
    setOpen(depth < 2);
  }, [collapseKey, depth]);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-[#1E293B]/50 cursor-pointer select-none"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        ) : (
          <span className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="text-sm text-slate-700 dark:text-[#E2E8F0] flex-1">{node.name}</span>
        <span className={`text-sm font-medium ${node.amount >= 0 ? ACCENT.green : ACCENT.red}`}>{fmt(node.amount)}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child, i) => (
            <AccountNode key={i} node={child} depth={depth + 1} collapseKey={collapseKey} />
          ))}
        </div>
      )}
    </div>
  );
};

const VyaparRow = ({ label, amount, type, children, depth = 0, open, onToggle }) => {
  const isSection = type === 'section';
  const isTotal = type === 'total';
  const color = isTotal ? 'text-slate-900 dark:text-[#F8FAFC]' : (type === 'expense' || amount < 0) ? ACCENT.red : ACCENT.green;

  return (
    <>
      <div
        className={`flex items-center ${isSection ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1E293B]/50' : ''} ${isTotal ? 'bg-slate-50 dark:bg-[#111827] border-t border-slate-200 dark:border-[#334155]' : 'border-b border-slate-100 dark:border-[#334155]/50'}`}
        style={{ paddingLeft: `${depth * 20 + 16}px` }}
        onClick={isSection ? onToggle : undefined}
      >
        <div className="flex-1 py-2.5 pr-4">
          {isSection && (
            <span className="mr-1.5 inline-block">
              {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </span>
          )}
          <span className={`${isTotal ? 'font-bold text-sm' : 'text-sm'} ${isTotal ? 'text-slate-900 dark:text-[#F8FAFC]' : 'text-slate-700 dark:text-[#E2E8F0]'}`}>
            {label}
          </span>
        </div>
        <div className={`py-2.5 pl-4 text-right min-w-[120px] ${isTotal ? 'font-bold text-sm' : 'text-sm font-medium'} ${color}`}>
          {fmt(amount)}
        </div>
      </div>
      {isSection && children && open && children.map((child, i) => (
        <VyaparRow key={i} label={child.name || child.label} amount={child.amount} type={child.type || 'expense'} depth={depth + 1} />
      ))}
    </>
  );
};

const ProfitLossReport = () => {
  const [view, setView] = useState('vyapar');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [vyaparData, setVyaparData] = useState(null);
  const [acctData, setAcctData] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [collapseKey, setCollapseKey] = useState(0);
  const printRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
      if (view === 'vyapar') {
        const res = await reportAPI.getProfit(params);
        setVyaparData(res.data || null);
        setAcctData(null);
      } else {
        const res = await reportAPI.getProfitLoss(params);
        setAcctData(res.data || null);
        setVyaparData(null);
      }
    } catch { setVyaparData(null); setAcctData(null); }
    finally { setLoading(false); }
  }, [view, dates]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSection = (key) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const collapseAll = () => {
    setOpenSections({ incomes: false, expenses: false });
    setCollapseKey((k) => k + 1);
  };

  const expandAll = () => {
    setOpenSections({ incomes: true, expenses: true });
    setCollapseKey((k) => k + 1);
  };

  const handlePrint = () => {
    const rows = [];
    if (view === 'vyapar') {
      (vyaparData?.lineItems || []).forEach((item) => {
        rows.push({ particular: item.label, amount: item.amount });
        if (item.children && item.children.length > 0) {
          item.children.forEach((c) => rows.push({ particular: '  ' + (c.name || c.label), amount: c.amount }));
        }
      });
    } else {
      const addTree = (nodes, prefix = '') => {
        (nodes || []).forEach((n) => {
          rows.push({ particular: prefix + n.name, amount: n.amount });
          if (n.children && n.children.length > 0) addTree(n.children, prefix + '  ');
        });
      };
      rows.push({ particular: 'Incomes', amount: acctData?.totalIncome || 0 });
      addTree(acctData?.incomeTree || [], '  ');
      rows.push({ particular: 'Expenses', amount: acctData?.totalExpense || 0 });
      addTree(acctData?.expenseTree || [], '  ');
      rows.push({ particular: 'Net Profit', amount: acctData?.netProfit || 0 });
    }
    printReport('Profit And Loss Report', [{ key: 'particular', label: 'Particulars' }, { key: 'amount', label: 'Amount' }], rows);
  };

  if (loading) return <LoadingSpinner />;

  const totalIncome = view === 'vyapar' ? (vyaparData?.totalSales ?? 0) : (acctData?.totalIncome ?? 0);
  const totalExpenses = view === 'vyapar' ? (vyaparData?.totalExpenses ?? 0) : (acctData?.totalExpense ?? 0);
  const netProfit = view === 'vyapar' ? (vyaparData?.netProfit ?? 0) : (acctData?.netProfit ?? 0);
  const lineItems = vyaparData?.lineItems || [];
  const incomeTree = acctData?.incomeTree || [];
  const expenseTree = acctData?.expenseTree || [];
  const allCollapsed = openSections.incomes === false && openSections.expenses === false;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <ReportHeader
        title="Profit And Loss Report"
        onDateChange={(t, v) => setDates({ ...dates, [t]: v })}
        startDate={dates.start}
        endDate={dates.end}
      />

      <div className="px-6 pt-4 pb-2 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#94A3B8]">
          <span>View :</span>
          {['vyapar', 'accounting'].map((v) => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="plView"
                value={v}
                checked={view === v}
                onChange={() => setView(v)}
                className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="capitalize text-sm">{v === 'vyapar' ? 'Vyapar' : 'Accounting'}</span>
            </label>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {view === 'accounting' && (
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="text-xs text-blue-600 dark:text-[#3B82F6] hover:underline"
            >
              {allCollapsed ? 'Expand all accounts' : 'Collapse all accounts'}
            </button>
          )}
          <button
            onClick={handlePrint}
            className="p-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-lg hover:bg-slate-50 dark:hover:bg-[#334155] transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4 text-slate-500 dark:text-[#94A3B8]" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-6" ref={printRef}>
        <div className="border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="flex bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#334155]">
            <div className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase tracking-wider">Particulars</div>
            <div className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-[#64748B] uppercase tracking-wider min-w-[120px]">Amount</div>
          </div>

          {view === 'vyapar' ? (
            <div>
              {lineItems.map((item, i) => (
                <VyaparRow
                  key={i}
                  label={item.label}
                  amount={item.amount}
                  type={item.type}
                  children={item.children}
                  depth={0}
                  open={openSections[i]}
                  onToggle={() => toggleSection(i)}
                />
              ))}
              {lineItems.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">No data available</div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {/* Incomes */}
              <div className="py-2 px-2">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setOpenSections((p) => ({ ...p, incomes: p.incomes === false ? true : false }))}
                >
                  {openSections.incomes !== false ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">Incomes</span>
                  <span className={`ml-auto text-sm font-medium ${ACCENT.green}`}>{fmt(acctData?.totalIncome || 0)}</span>
                </div>
                {openSections.incomes !== false && (
                  <div className="ml-2 mt-1">
                    {incomeTree.length === 0 ? (
                      <div className="py-2 px-4 text-sm text-slate-400 dark:text-[#64748B]">No income accounts</div>
                    ) : (
                      incomeTree.map((node, i) => <AccountNode key={i} node={node} depth={1} collapseKey={collapseKey} />)
                    )}
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div className="py-2 px-2">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setOpenSections((p) => ({ ...p, expenses: p.expenses === false ? true : false }))}
                >
                  {openSections.expenses !== false ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">Expenses</span>
                  <span className={`ml-auto text-sm font-medium ${ACCENT.red}`}>{fmt(acctData?.totalExpense || 0)}</span>
                </div>
                {openSections.expenses !== false && (
                  <div className="ml-2 mt-1">
                    {expenseTree.length === 0 ? (
                      <div className="py-2 px-4 text-sm text-slate-400 dark:text-[#64748B]">No expense accounts</div>
                    ) : (
                      expenseTree.map((node, i) => <AccountNode key={i} node={node} depth={1} collapseKey={collapseKey} />)
                    )}
                  </div>
                )}
              </div>

              {/* Net Profit */}
              <div className="border-t border-slate-200 dark:border-[#334155] mt-2 pt-3 px-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Net Profit (Incomes - Expenses)</span>
                <span className={`text-sm font-bold ${netProfit >= 0 ? ACCENT.green : ACCENT.red}`}>{fmt(netProfit)}</span>
              </div>

              {(incomeTree.length === 0 && expenseTree.length === 0) && (
                <div className="py-12 text-center text-sm text-slate-400 dark:text-[#64748B]">No accounting data available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfitLossReport;
