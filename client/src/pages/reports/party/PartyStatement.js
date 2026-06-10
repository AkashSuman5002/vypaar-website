import React, { useState, useEffect } from 'react';
import { ChevronDown, Download, Printer, Search } from 'lucide-react';
import { reportAPI, customerAPI, supplierAPI } from '../../../services/api';
import { exportToExcel, printReport } from '../../../utils/exportUtils';

const columns = [
  { key: 'date', label: 'Date', width: 'w-[100px]' },
  { key: 'txnType', label: 'Txn Type', width: 'w-[100px]' },
  { key: 'refNo', label: 'Ref No.', width: 'w-[100px]' },
  { key: 'paymentType', label: 'Payment Type', width: 'w-[110px]' },
  { key: 'total', label: 'Total', width: 'w-[100px]', align: 'right' },
  { key: 'received', label: 'Received', width: 'w-[100px]', align: 'right' },
  { key: 'txnBalance', label: 'Txn Balance', width: 'w-[100px]', align: 'right' },
  { key: 'receivableBalance', label: 'Receivable Balance', width: 'w-[120px]', align: 'right' },
  { key: 'payableBalance', label: 'Payable Balance', width: 'w-[120px]', align: 'right' },
];

const PartyStatement = () => {
  const [view, setView] = useState('vyapar');
  const [partyType, setPartyType] = useState('customer');
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadParties = async () => {
      try {
        const res = partyType === 'customer' ? await customerAPI.getAll() : await supplierAPI.getAll();
        setParties(Array.isArray(res.data) ? res.data : res.data?.customers || res.data?.suppliers || []);
      } catch { setParties([]); }
    };
    loadParties();
  }, [partyType]);

  useEffect(() => {
    if (!selectedParty) { setData(null); return; }
    const fetchStatement = async () => {
      setLoading(true);
      try {
        const res = await reportAPI.getPartyStatement({ partyId: selectedParty, partyType, startDate, endDate });
        setData(res.data);
      } catch { setData(null); }
      finally { setLoading(false); }
    };
    fetchStatement();
  }, [selectedParty, partyType, startDate, endDate]);

  const transactions = data?.transactions || [];

  return (
    <div className="p-4 bg-white dark:bg-gray-800 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Party Statement{data ? ` - ${data.partyName}` : ''}</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span>Between</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded px-2 py-1.5 w-[120px] text-xs" />
            <span>To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded px-2 py-1.5 w-[120px] text-xs" />
          </div>
          <div className="relative flex items-center gap-1">
            <select value={partyType} onChange={e => { setPartyType(e.target.value); setSelectedParty(''); }}
              className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 pr-7 text-xs text-gray-600 dark:text-gray-300">
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
            </select>
            <select value={selectedParty} onChange={e => setSelectedParty(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-gray-300 min-w-[130px]">
              <option value="">Select Party</option>
              {parties.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => exportToExcel(transactions, columns, `Party Statement - ${data?.partyName || 'Report'}`)} className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"><Download className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
          <button onClick={printReport} className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"><Printer className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-4">
        <button onClick={() => setView('vyapar')}
          className={`px-3 py-1.5 text-xs font-medium rounded ${view === 'vyapar' ? 'bg-gray-800 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'}`}>Vyapar</button>
        <button onClick={() => setView('accounting')}
          className={`px-3 py-1.5 text-xs font-medium rounded ${view === 'accounting' ? 'bg-gray-800 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'}`}>Accounting</button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-600 rounded overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.width}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!selectedParty ? (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Select a party to view statement</td></tr>
            ) : loading ? (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                <div className="flex flex-col items-center justify-center">
                  <svg width="80" height="60" viewBox="0 0 80 60" fill="none" className="mb-3">
                    <rect x="15" y="10" width="50" height="40" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/>
                    <rect x="22" y="18" width="36" height="4" rx="2" fill="#E5E7EB"/>
                    <rect x="22" y="26" width="25" height="3" rx="1.5" fill="#E5E7EB"/>
                    <rect x="22" y="32" width="30" height="3" rx="1.5" fill="#E5E7EB"/>
                  </svg>
                  <span className="text-sm text-gray-400 dark:text-gray-500">No transactions to show</span>
                </div>
              </td></tr>
            ) : transactions.map((tx, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '-'}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{tx.txnType}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{tx.refNo || '-'}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{tx.paymentType}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-right">₹{(tx.total || 0).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-right">₹{(tx.received || 0).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-right">₹{(tx.txnBalance || 0).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-right">₹{(tx.receivableBalance || 0).toLocaleString()}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-right">₹{(tx.payableBalance || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {data && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Party Statement Summary</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Opening Balance', value: `₹${(data.openingBalance || 0).toLocaleString()}` },
              { label: 'Total Due', value: `₹${(data.totalDue || 0).toLocaleString()}` },
              { label: 'Total Paid', value: `₹${(data.totalPaid || 0).toLocaleString()}` },
              { label: 'Outstanding', value: `₹${(data.outstanding || 0).toLocaleString()}`, className: (data.outstanding || 0) > 0 ? 'text-red-600 font-bold' : '' },
            ].map((s) => (
              <div key={s.label} className="border border-gray-200 rounded px-3 py-2 min-w-[130px]">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                <p className={`text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5 ${s.className || ''}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyStatement;
