import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../../utils/exportUtils';

const section1Cols = [
  { key: 'nature', label: 'Nature Of Supplies', width: '300px' },
  { key: 'taxableValue', label: 'Taxable Value', width: '130px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'igst', label: 'Integrated Tax', width: '120px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'cgst', label: 'Central Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'sgst', label: 'State/UT Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
];

const section3Cols = [
  { key: 'nature', label: 'Nature', width: '300px' },
  { key: 'igst', label: 'Integrated Tax', width: '120px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'cgst', label: 'Central Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
  { key: 'sgst', label: 'State/UT Tax', width: '110px', align: 'right', render: (v) => `₹${(v||0).toLocaleString()}` },
];

const SectionBox = ({ title, columns, data, index, children }) => (
  <div className="mb-6 px-6">
    <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-t px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-[#E2E8F0]">
      Section {index}: {title}
    </div>
    {children || <GSTTable columns={columns} data={data} />}
  </div>
);

const GSTR3B = () => {
  const [gstr3b, setGstr3b] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      if (!dates.start || !dates.end) return;
      setLoading(true);
      try {
        const res = await reportAPI.getGSTR3B({ startDate: dates.start, endDate: dates.end });
        setGstr3b(res.data.gstr3b);
      } catch (err) { console.error('Failed to load GSTR3B', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  const setDate = (type, value) => setDates(prev => ({...prev, [type]: value}));

  if (loading && dates.start) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  const supplyData = gstr3b ? [
    { nature: '(a) Outward taxable supplies', taxableValue: gstr3b.supply.taxableValue, igst: 0, cgst: gstr3b.supply.centralTax, sgst: gstr3b.supply.stateTax },
    { nature: 'Total', taxableValue: gstr3b.supply.taxableValue, igst: 0, cgst: gstr3b.supply.centralTax, sgst: gstr3b.supply.stateTax },
  ] : [];

  const itcData = gstr3b ? [
    { nature: 'ITC Available', igst: 0, cgst: gstr3b.itc.centralTax, sgst: gstr3b.itc.stateTax },
    { nature: 'Total ITC', igst: 0, cgst: gstr3b.itc.centralTax, sgst: gstr3b.itc.stateTax },
  ] : [];

  return (
    <div className="bg-white dark:bg-[#0F172A] min-h-full">
      <GSTFilterBar title="GSTR 3B" showNonTax={false} onDateChange={setDate} startDate={dates.start} endDate={dates.end}
        onExcel={() => exportToExcel([...supplyData, ...itcData], [...section1Cols, ...section3Cols], 'GSTR3B Report')}
        onPrint={() => printReport('GSTR3B Report', section1Cols, supplyData)} />
      {!dates.start ? (
        <div className="p-6 text-center text-sm text-gray-500 dark:text-[#64748B]">Select a period to load GSTR 3B data.</div>
      ) : gstr3b ? (
        <>
          <SectionBox index={1} title="Outward supplies and inward supplies liable to reverse charge" columns={section1Cols} data={supplyData} />
          <SectionBox index={3} title="Eligible input tax credit" columns={section3Cols} data={itcData} />
          <div className="px-6 mb-6">
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#E2E8F0] mb-2">Net GST Payable</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-[#3B82F6]">
                ₹{gstr3b.netGSTPayable.toLocaleString()}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="p-6 text-center text-sm text-gray-500 dark:text-[#64748B]">No data available for the selected period.</div>
      )}
    </div>
  );
};

export default GSTR3B;
