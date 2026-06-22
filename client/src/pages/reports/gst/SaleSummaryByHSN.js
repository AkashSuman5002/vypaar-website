import React, { useState, useEffect } from 'react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { exportToExcel } from '../../../utils/exportUtils';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'hsn', label: 'HSN', width: 'w-[150px]' },
  { key: 'quantity', label: 'Quantity', width: 'w-[110px]', align: 'right' },
  { key: 'taxableAmount', label: 'Taxable Value', width: 'w-[140px]', align: 'right' },
  { key: 'gstAmount', label: 'GST Amount', width: 'w-[130px]', align: 'right' },
];

const currentYear = new Date().getFullYear();
const fyStart = new Date().getMonth() >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
const today = new Date().toISOString().split('T')[0];

const SaleSummaryByHSN = () => {
  const [hsnData, setHsnData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(fyStart);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
        const res = await reportAPI.getHSN(params);
        setHsnData(res.data.hsnSummary || []);
      } catch (err) { console.error('Failed to load HSN summary', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dateFrom, dateTo]);

  if (loading) return <LoadingSpinner />;

  const totalTaxable = hsnData.reduce((s, h) => s + (h.taxableAmount || 0), 0);
  const totalGST = hsnData.reduce((s, h) => s + (h.gstAmount || 0), 0);

  const exportData = hsnData.map((row, i) => ({ index: i + 1, hsn: row.hsn, quantity: row.quantity, taxableAmount: row.taxableAmount, gstAmount: row.gstAmount }));

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">Sale Summary by HSN</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#94A3B8]">
            <span>Between</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8] rounded px-2 py-1.5 w-[110px] text-xs" />
            <span>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8] rounded px-2 py-1.5 w-[110px] text-xs" />
          </div>
          <button onClick={() => exportToExcel(exportData, columns, 'Sale_Summary_By_HSN')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
        </div>
      </div>
      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
            {hsnData.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">No HSN data available.</td></tr>
            ) : (
              hsnData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                  <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{i + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] font-medium">{row.hsn}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">{row.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{(row.taxableAmount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC] font-medium">₹{(row.gstAmount || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
          {hsnData.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155] font-semibold">
                <td colSpan={2} className="px-3 py-2.5 text-right text-gray-700 dark:text-[#E2E8F0]">Total</td>
                <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#E2E8F0]">{hsnData.reduce((s, h) => s + (h.quantity || 0), 0)}</td>
                <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#E2E8F0]">₹{totalTaxable.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#E2E8F0]">₹{totalGST.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default SaleSummaryByHSN;
