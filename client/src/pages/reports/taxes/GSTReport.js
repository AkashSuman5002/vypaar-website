import React, { useState, useEffect } from 'react';
import { Search, Download, Printer } from 'lucide-react';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { reportAPI } from '../../../services/api';

const GSTReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await reportAPI.getGST();
        setData(res.data.gstSummary || []);
      } catch (err) { console.error('Failed to load GST report', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">GST Report</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..." className="pl-7 pr-3 py-1.5 border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] rounded text-xs w-[180px] placeholder-gray-500 dark:placeholder-[#64748B]" />
          </div>
          <button className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
          <button className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        </div>
      </div>
      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">GST Rate</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Taxable Value</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">CGST</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">SGST</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">IGST</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Total GST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#334155]/50">
            {filteredData.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">No GST data available.</td></tr>
            ) : (
              filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1E293B]/40">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{row.rate}%</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{(row.taxableAmount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{(row.cgst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{(row.sgst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC]">₹{(row.igst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900 dark:text-[#F8FAFC] font-medium">₹{((row.cgst||0)+(row.sgst||0)+(row.igst||0)).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GSTReport;
