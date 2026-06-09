import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import ReportHeader from '../../../components/reports/common/ReportHeader';
import EmptyState from '../../../components/reports/common/EmptyState';

const GSTR2AReconciliation = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getGSTR2AReconciliation(params);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load GSTR-2A reconciliation', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [dates]);

  if (loading) return <LoadingSpinner />;

  const matched = data?.matched || [];
  const mismatched = data?.mismatched || [];
  const filteredMatched = matched.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const filteredMismatched = mismatched.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const hasData = filteredMatched.length > 0 || filteredMismatched.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-[#0F172A] min-h-full">
        <ReportHeader title="GSTR-2A Reconciliation" onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
        <EmptyState icon={<FileText className="w-12 h-12 text-gray-300" />} title="No Reconciliation Data" subtitle="Purchase invoices matched with GSTR-2A will appear here." />
      </div>
    );
  }

  const renderTable = (title, items, icon, isMismatched) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-[#F8FAFC]">{title} ({items.length})</h3>
      </div>
      <div className="border border-gray-200 dark:border-[#334155] rounded-xl overflow-hidden">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0A0A0 transparent' }}>
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-[#334155]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Supplier</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Invoice No</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Date</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Taxable</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">IGST</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">CGST</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">SGST</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Total</th>
                {isMismatched && <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase tracking-wider">Difference</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.supplierName || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-[#CBD5E1]">{item.invoiceNo || '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">₹{Number(item.taxableValue || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">₹{Number(item.igst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">₹{Number(item.cgst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-[#CBD5E1]">₹{Number(item.sgst || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-[#F8FAFC]">₹{Number(item.total || 0).toLocaleString()}</td>
                  {isMismatched && <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400 font-medium">₹{Number(item.difference || 0).toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full flex flex-col">
      <ReportHeader title="GSTR-2A Reconciliation" search={search} onSearchChange={setSearch} onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} />
      <div className="flex-1 px-4 pb-4">
        {filteredMatched.length > 0 && renderTable('Matched Invoices', filteredMatched, <CheckCircle className="w-4 h-4 text-green-500" />, false)}
        {filteredMismatched.length > 0 && renderTable('Mismatched Invoices', filteredMismatched, <XCircle className="w-4 h-4 text-red-500" />, true)}
      </div>
    </div>
  );
};

export default GSTR2AReconciliation;
