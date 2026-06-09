import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'gstin', label: 'GSTIN/UIN', width: '140px' },
  { key: 'partyName', label: 'Party Name', width: '160px' },
  { key: 'invoiceNo', label: 'Invoice No', width: '110px' },
  { key: 'date', label: 'Date', width: '100px' },
  { key: 'value', label: 'Value', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'taxableValue', label: 'Taxable Value', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'cgst', label: 'Central Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'sgst', label: 'State/UT Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'igst', label: 'Integrated Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
];

const GSTR1 = () => {
  const [activeTab, setActiveTab] = useState('B2B');
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getGSTR1(params);
        setInvoices(res.data.invoices || []);
        setSummary(res.data.summary);
      } catch (err) { console.error('Failed to load GSTR1', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const setDate = (type, value) => setDates(prev => ({...prev, [type]: value}));

  const tabs = ['B2B', 'B2C'];
  const filtered = activeTab === 'B2B'
    ? invoices.filter(i => i.customer && i.customerName !== 'Walk-in')
    : invoices.filter(i => !i.customer || i.customerName === 'Walk-in');

  const mappedData = filtered.map((inv) => ({
    gstin: inv.customer?.gstNumber || 'Unregistered',
    partyName: inv.customerName || 'Walk-in',
    invoiceNo: inv.invoiceNumber,
    date: new Date(inv.date).toLocaleDateString(),
    value: inv.totalAmount,
    taxableValue: inv.taxableAmount,
    cgst: inv.cgstTotal,
    sgst: inv.sgstTotal,
    igst: inv.igstTotal,
  }));

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <GSTFilterBar title="GSTR 1" onDateChange={setDate} startDate={dates.start} endDate={dates.end} />
      <div className="px-6 pt-6">
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-[#64748B]">Total Invoices</p>
              <p className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">{summary.totalInvoices}</p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-[#64748B]">Total Taxable Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">₹{summary.totalTaxable.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-[#64748B]">Total GST</p>
              <p className="text-lg font-bold text-blue-600 dark:text-[#3B82F6]">₹{summary.totalGST.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-[#64748B]">B2B / B2C</p>
              <p className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">{summary.b2bCount} / {summary.b2cCount}</p>
            </div>
          </div>
        )}
        <div className="flex gap-4 border-b border-gray-200 dark:border-[#334155] mb-4">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium relative ${activeTab === tab ? 'text-blue-600 dark:text-[#3B82F6]' : 'text-gray-500 dark:text-[#64748B] hover:text-gray-700 dark:hover:text-[#E2E8F0]'}`}>
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-[#3B82F6]" />}
            </button>
          ))}
        </div>
        <GSTTable columns={columns} data={mappedData} />
      </div>
    </div>
  );
};

export default GSTR1;
