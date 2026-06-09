import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

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

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <GSTFilterBar title="GSTR 2" onDateChange={setDate} startDate={dates.start} endDate={dates.end} />
      <GSTTable columns={columns} data={data} />
    </>
  );
};

export default GSTR2;
