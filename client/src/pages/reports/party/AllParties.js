import React, { useState, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'index', label: '#', width: 'w-[50px]' },
  { key: 'name', label: 'Party Name', width: 'w-[180px]' },
  { key: 'type', label: 'Type', width: 'w-[90px]' },
  { key: 'phone', label: 'Phone No.', width: 'w-[140px]' },
  { key: 'totalSales', label: 'Total Sales/Purchases', width: 'w-[160px]', align: 'right' },
  { key: 'totalPaid', label: 'Total Paid', width: 'w-[140px]', align: 'right' },
  { key: 'outstanding', label: 'Outstanding Balance', width: 'w-[160px]', align: 'right' },
];

const AllParties = () => {
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [custRes, suppRes] = await Promise.all([
          reportAPI.getParties({ partyType: 'customer' }),
          reportAPI.getParties({ partyType: 'supplier' }),
        ]);
        setCustomers(custRes.data.parties || []);
        setSuppliers(suppRes.data.parties || []);
      } catch (err) {
        console.error('Failed to load parties', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const allParties = [
    ...customers.map(c => ({ ...c, type: 'Customer', totalSalesOrPurchases: c.totalSales, totalPaid: c.totalPaid, outstanding: c.outstanding })),
    ...suppliers.map(s => ({ ...s, type: 'Supplier', totalSalesOrPurchases: s.totalPurchases, totalPaid: s.totalPaid, outstanding: s.outstanding })),
  ].filter(p => !searchText || p.name?.toLowerCase().includes(searchText.toLowerCase()));

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="p-4 bg-white dark:bg-[#0F172A] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">All Parties</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B]" />
            <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search..." className="pl-7 pr-3 py-1.5 border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] rounded text-xs w-[180px] placeholder-gray-500 dark:placeholder-[#64748B]" />
          </div>
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
          <tbody>
            {allParties.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">
                  <div className="flex flex-col items-center justify-center">
                    <svg width="80" height="60" viewBox="0 0 80 60" fill="none" className="mb-3">
                      <rect x="15" y="10" width="50" height="40" rx="4" className="fill-slate-200 stroke-slate-300 dark:fill-[#1E293B] dark:stroke-[#334155]" strokeWidth="1"/>
                      <rect x="22" y="18" width="36" height="4" rx="2" className="fill-slate-300 dark:fill-[#334155]"/>
                      <rect x="22" y="26" width="25" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                      <rect x="22" y="32" width="30" height="3" rx="1.5" className="fill-slate-300 dark:fill-[#334155]"/>
                    </svg>
                    <span className="text-sm text-gray-500 dark:text-[#64748B]">No data is available for All Party</span>
                  </div>
                </td>
              </tr>
            ) : (
              allParties.map((item, idx) => (
                <tr key={item._id || idx} className="border-b border-gray-200 dark:border-[#334155]">
                  <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC]">{item.name || '-'}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'Customer' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{item.type}</span></td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-[#64748B]">{item.phone || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.totalSalesOrPurchases ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-[#F8FAFC] text-right">₹{(item.totalPaid ?? 0).toLocaleString()}</td>
                  <td className={`px-3 py-2.5 text-right ${(item.outstanding ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-gray-900 dark:text-[#F8FAFC]'}`}>₹{(item.outstanding ?? 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-[#334155]">
              <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">Total</td>
              <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{allParties.reduce((s, d) => s + (d.totalSalesOrPurchases ?? 0), 0).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{allParties.reduce((s, d) => s + (d.totalPaid ?? 0), 0).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-[#E2E8F0] text-right">₹{allParties.reduce((s, d) => s + (d.outstanding ?? 0), 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default AllParties;
