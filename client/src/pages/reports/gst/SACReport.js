import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';

const columns = [
  { key: 'sac', label: 'SAC Code', width: '130px' },
  { key: 'description', label: 'Description', width: '250px' },
  { key: 'value', label: 'Value', width: '150px', align: 'right' },
  { key: 'tax', label: 'Tax', width: '120px', align: 'right' },
];

const SACReport = () => {
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
        const res = await reportAPI.getSAC(params);
        setData(res.data.sacSummary || []);
      } catch (err) { console.error('Failed to load SAC report', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [dates]);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <GSTFilterBar title="SAC Report" showNonTax={false} onDateChange={setDate} startDate={dates.start} endDate={dates.end} />
      <GSTTable columns={columns} data={data} />
    </>
  );
};

export default SACReport;
