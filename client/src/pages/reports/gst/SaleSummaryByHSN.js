import React, { useState, useEffect } from 'react';
import { Search, Download, Printer, Filter } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const SaleSummaryByHSN = () => {
  const [hsnData, setHsnData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await reportAPI.getHSN();
        setHsnData(res.data.hsnSummary || []);
      } catch (err) { console.error('Failed to load HSN summary', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  const totalTaxable = hsnData.reduce((s, h) => s + (h.taxableAmount || 0), 0);
  const totalGST = hsnData.reduce((s, h) => s + (h.gstAmount || 0), 0);

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">Sale Summary by HSN</h2>
        <div className="flex items-center gap-2">
          <button className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
          <button className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        </div>
      </div>
      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">#</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">HSN</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Quantity</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Taxable Value</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">GST Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
            {hsnData.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">No HSN data available.</td></tr>
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
