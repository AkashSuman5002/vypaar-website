import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../../utils/exportUtils';

const columns = [
  { key: 'gstin', label: 'GSTIN/UIN', width: '140px' },
  { key: 'partyName', label: 'Party Name', width: '160px' },
  { key: 'billNo', label: 'Bill No', width: '110px' },
  { key: 'date', label: 'Date', width: '100px' },
  { key: 'value', label: 'Value', width: '110px', align: 'right' },
  { key: 'rate', label: 'Rate', width: '80px', align: 'right' },
  { key: 'cessRate', label: 'Cess Rate', width: '90px', align: 'right' },
  { key: 'taxableValue', label: 'Taxable Value', width: '120px', align: 'right' },
  { key: 'reverseCharge', label: 'Reverse Charge', width: '120px', align: 'right' },
  { key: 'igst', label: 'Integrated Tax', width: '120px', align: 'right' },
  { key: 'cgst', label: 'Central Tax', width: '110px', align: 'right' },
  { key: 'sgst', label: 'State/UT Tax', width: '110px', align: 'right' },
  { key: 'cess', label: 'Cess', width: '90px', align: 'right' },
  { key: 'pos', label: 'Place Of Supply (State Name)', width: '180px' },
];

const GSTR2 = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [nonTaxAsExempted, setNonTaxAsExempted] = useState(false);

  const setDate = (type, value) => setDates(prev => ({ ...prev, [type]: value }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getGSTR2(params);
        setData(res.data.invoices || []);
      } catch (err) { console.error('Failed to load GSTR2', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  // When considering non-tax as exempted, reclassify zero-tax rows as Exempted
  // and exclude their taxable value from the displayed figures.
  const displayData = nonTaxAsExempted
    ? data.map((row) => {
        const tax = (Number(row.igst) || 0) + (Number(row.cgst) || 0) + (Number(row.sgst) || 0);
        return tax === 0 ? { ...row, gstin: 'Exempted', taxableValue: 0 } : row;
      })
    : data;

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <GSTFilterBar title="GSTR 2" onDateChange={setDate} startDate={dates.start} endDate={dates.end}
        nonTaxAsExempted={nonTaxAsExempted} onNonTaxChange={setNonTaxAsExempted}
        onExcel={() => exportToExcel(displayData, columns, 'GSTR2 Report')}
        onPrint={() => printReport('GSTR2 Report', columns, displayData)} />
      <GSTTable columns={columns} data={displayData} />
    </>
  );
};

export default GSTR2;
