import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const fmt = (v) => v == null || isNaN(v) ? '₹0' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (v) => v ?? 0;

const Tbl = ({ columns, data, headerBg = 'bg-white dark:bg-[#1E293B]' }) => (
  <div className="border border-gray-200 dark:border-[#334155] rounded overflow-hidden mt-2">
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className={`${headerBg} border-b border-gray-200 dark:border-[#334155]`}>
            {columns.map((col, i) => (
              <th key={i} className={`px-3 py-2 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200/50 dark:divide-[#334155]/50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-[#64748B]">No data</td>
            </tr>
          ) : data.map((row, i) => (
            <tr key={i} className={row.bold ? 'font-semibold bg-white/50 dark:bg-[#1E293B]/50' : ''}>
              {columns.map((col, j) => (
                <td key={j} className={`px-3 py-1.5 text-sm text-gray-700 dark:text-[#E2E8F0] ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SectionTitle = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-t px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-[#E2E8F0] mt-5 ${className}`}>{children}</div>
);

const rateCols = [
  { key: 'label', label: '' },
  { key: 'rate', label: 'Rate', align: 'right', render: (v) => v != null ? v + '%' : '-' },
  { key: 'taxable', label: 'Taxable Value', align: 'right', render: (v) => fmt(v) },
  { key: 'igst', label: 'Integrated Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'cgst', label: 'Central Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'sgst', label: 'State/UT Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'cess', label: 'Cess', align: 'right', render: (v) => fmt(v) },
];

const itcCols = [
  { key: 'label', label: '' },
  { key: 'igst', label: 'Integrated Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'cgst', label: 'Central Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'sgst', label: 'State/UT Tax', align: 'right', render: (v) => fmt(v) },
  { key: 'cess', label: 'Cess', align: 'right', render: (v) => fmt(v) },
];

const twoCols = [
  { key: 'label', label: '' },
  { key: 'value', label: 'Amount', align: 'right', render: (v) => fmt(v) },
];

const fmtRateRow = (label, d, bold) => ({ label, rate: d.rate, taxable: d.taxableValue, igst: d.igst, cgst: d.cgst, sgst: d.sgst, cess: d.cess, bold });
const sectionHeader = (label) => ({ label, bold: true });

const rateRows = (items, prefix) => {
  const rows = [];
  if (!items || items.length === 0) {
    rows.push({ label: `${prefix}`, rate: '-', taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    return rows;
  }
  items.forEach(r => rows.push(fmtRateRow(`${prefix} ${r.rate}%`, r)));
  return rows;
};

const ITCrow = (label, d, bold) => ({ label, igst: d.igst, cgst: d.cgst, sgst: d.sgst, cess: d.cess, bold });

const GSTR9 = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState('2025');
  const printRef = useRef();

  const fys = [];
  const cy = new Date().getFullYear();
  for (let y = cy - 1; y >= cy - 5; y--) fys.push(y);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await reportAPI.getGSTR9({ financialYear: fy });
        setData(res.data);
      } catch (err) {
        console.error('Failed to load GSTR9 data', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fy]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = printRef.current?.innerHTML;
    if (!content) return;
    win.document.write(`
      <html><head><title>GSTR-9 Annual Return</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}.right{text-align:right}h2{margin-bottom:5px}.card{display:inline-block;margin:8px;padding:10px;border:1px solid #ddd;border-radius:4px;min-width:180px}.card-value{font-size:18px;font-weight:bold}</style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  const s = data?.summary || {};
  const p2 = data?.part2 || {};
  const p3 = data?.part3 || {};
  const p4 = data?.part4 || {};
  const p5 = data?.part5 || {};
  const p6 = data?.part6 || {};
  const meta = data?.meta || {};

  const fmtITC = (obj) => ({ igst: obj.igst || 0, cgst: obj.cgst || 0, sgst: obj.sgst || 0, cess: obj.cess || 0 });

  const emptyState = !data || (meta.totalSales === 0 && meta.totalPurchases === 0 && meta.totalCreditNotes === 0);

  return (
    <div ref={printRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">ANNUAL GST RETURN (GSTR-9)</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={fy} onChange={e => setFy(e.target.value)} className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-[#94A3B8]">
              {fys.map(y => <option key={y} value={y}>{y}-{y + 1}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
          </div>
          <button onClick={handlePrint} className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-gray-100 dark:hover:bg-[#1E293B]/70"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        </div>
      </div>

      {emptyState ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="mb-4">
            <rect x="15" y="12" width="60" height="46" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
            <rect x="24" y="21" width="42" height="5" rx="2.5" fill="#334155"/>
            <rect x="24" y="30" width="28" height="3" rx="1.5" fill="#334155"/>
            <rect x="24" y="37" width="35" height="3" rx="1.5" fill="#334155"/>
          </svg>
          <p className="text-sm text-gray-500 dark:text-[#64748B] text-center max-w-xs">No GSTR-9 data available for this financial year.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Taxable Turnover', value: s.taxableTurnover, color: 'text-gray-900 dark:text-[#F8FAFC]' },
              { label: 'Total GST Collected', value: s.totalGSTCollected, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Total ITC Claimed', value: s.totalITCClaimed, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Net GST Liability', value: s.netGSTLiability, color: 'text-red-600 dark:text-red-400' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-[#64748B]">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>{fmt(card.value)}</p>
              </div>
            ))}
          </div>

          {/* Part I */}
          <SectionTitle>Part I — Basic Details</SectionTitle>
          <div className="border border-gray-200 dark:border-[#334155] border-t-0 rounded-b px-4 py-3 text-sm text-gray-600 dark:text-[#94A3B8]">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <div><span className="text-gray-500 dark:text-[#64748B]">Financial Year: </span><span className="text-gray-900 dark:text-[#F8FAFC]">{data?.financialYear || '-'}</span></div>
              <div><span className="text-gray-500 dark:text-[#64748B]">Period: </span><span className="text-gray-900 dark:text-[#F8FAFC]">April - March</span></div>
              <div><span className="text-gray-500 dark:text-[#64748B]">Total Sales Invoices: </span><span className="text-gray-900 dark:text-[#F8FAFC]">{meta.totalSales}</span></div>
              <div><span className="text-gray-500 dark:text-[#64748B]">Total Purchases: </span><span className="text-gray-900 dark:text-[#F8FAFC]">{meta.totalPurchases}</span></div>
            </div>
          </div>

          {/* Part II */}
          <SectionTitle>Part II — Details Of Outward And Inward Supplies</SectionTitle>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] border-t-0 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-[#94A3B8]">
            Table 4 — Details of advances, inward and outward supplies
          </div>
          <Tbl columns={rateCols} data={[
            sectionHeader('A — Supplies to registered persons (B2B)'),
            ...rateRows(p2.rateWiseB2B, 'B2B'),
            sectionHeader('B — Supplies to unregistered persons (B2C)'),
            ...rateRows(p2.rateWiseB2C, 'B2C'),
            sectionHeader('C — Zero rated supply (Export)'),
            fmtRateRow('Exports', p2.exports || {}),
            sectionHeader('D — Supplies to SEZs'),
            fmtRateRow('SEZ Supplies', p2.sezSupplies || {}),
            sectionHeader('E — Deemed Exports'),
            fmtRateRow('Deemed Exports', p2.deemedExports || {}),
            sectionHeader('F — Credit Notes'),
            fmtRateRow('Credit Notes', p2.creditNotes || {}),
            sectionHeader('G — Debit Notes'),
            fmtRateRow('Debit Notes', p2.debitNotes || {}),
            sectionHeader('H — Advances received'),
            fmtRateRow('Advances', p2.advances || {}),
          ]} headerBg="bg-gray-50 dark:bg-[#111827]" />

          {/* Part III */}
          <SectionTitle>Part III — Details Of Input Tax Credit (ITC)</SectionTitle>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] border-t-0 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-[#94A3B8]">
            ITC summary from purchases
          </div>
          <Tbl columns={itcCols} data={[
            ITCrow('ITC Availed (from purchases)', fmtITC(p3.itcAvailed || {}), true),
            ITCrow('ITC Reversed (from purchase returns)', fmtITC(p3.itcReversed || {}), true),
            ITCrow('Net ITC Available', fmtITC(p3.netITC || {}), true),
            ITCrow('Ineligible ITC', fmtITC(p3.ineligibleITC || {}), true),
            ITCrow('Total ITC Claimed', fmtITC(p3.netITC || {}), true),
          ]} />

          {/* Part IV */}
          <SectionTitle>Part IV — Details Of Tax Paid</SectionTitle>
          <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] border-t-0 px-4 py-2 text-xs font-semibold text-gray-600 dark:[#94A3B8]">
            Tax paid on outward supplies (net of credit notes)
          </div>
          <Tbl columns={itcCols} data={[
            ITCrow('Integrated Tax (IGST)', fmtITC({ igst: p4.taxPaid?.igst }), true),
            ITCrow('Central Tax (CGST)', fmtITC({ cgst: p4.taxPaid?.cgst }), true),
            ITCrow('State/UT Tax (SGST)', fmtITC({ sgst: p4.taxPaid?.sgst }), true),
            ITCrow('Cess', fmtITC({ cess: p4.taxPaid?.cess }), true),
            ITCrow('Total Tax Paid', fmtITC(p4.taxPaid || {}), true),
          ]} />

          {/* Part V */}
          <SectionTitle>Part V — Previous Year Adjustments</SectionTitle>
          <Tbl columns={twoCols} data={[
            { label: 'Credit Notes (carried forward)', value: p5.creditNotes?.taxableValue || 0 },
            { label: 'Debit Notes (carried forward)', value: p5.debitNotes?.taxableValue || 0 },
            { label: 'Amendments', value: p5.amendments?.taxableValue || 0 },
          ]} />

          {/* Part VI */}
          <SectionTitle>Part VI — Other Information</SectionTitle>
          <div className="mt-3 mb-2 text-sm font-semibold text-gray-700 dark:text-[#E2E8F0]">15. Refunds and Demands</div>
          <Tbl columns={twoCols} data={[
            { label: 'Total Refund Claimed', value: p6.refundClaimed || 0 },
            { label: 'Demand Raised', value: p6.demandRaised || 0 },
            { label: 'Demand Paid', value: p6.demandPaid || 0 },
          ]} />
          <div className="mt-3 mb-2 text-sm font-semibold text-gray-700 dark:text-[#E2E8F0]">19. Late Fee Payable And Paid</div>
          <Tbl columns={twoCols} data={[
            { label: 'Late Fees', value: p6.lateFees || 0 },
            { label: 'Interest Paid', value: p6.interestPaid || 0 },
          ]} />

          <div className="mt-6 text-xs text-gray-400 dark:text-[#64748B] text-center border-t border-gray-200 dark:border-[#334155] pt-4">
            GSTR-9 Annual Return — Generated from actual transaction data. Financial Year {data?.financialYear || '-'}
          </div>
        </>
      )}
    </div>
  );
};

export default GSTR9;
