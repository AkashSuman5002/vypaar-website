import React, { useState, useEffect } from 'react';
import GSTFilterBar from '../../../components/gst/GSTFilterBar';
import GSTTable from '../../../components/gst/GSTTable';
import { reportAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/UI/LoadingSpinner';
import { exportToExcel } from '../../../utils/exportUtils';

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
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-200 dark:border-[#334155]">
        <GSTFilterBar title="SAC Report" showNonTax={false} onDateChange={setDate} startDate={dates.start} endDate={dates.end} />
        <div className="flex items-center gap-3 ml-4">
          <button onClick={() => exportToExcel(data, columns, 'SAC_Report')} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Excel</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1E293B] text-gray-600 dark:text-[#94A3B8] border border-gray-300 dark:border-[#334155] hover:bg-gray-50 dark:hover:bg-[#1E293B]/70">Print</button>
        </div>
      </div>
      <GSTTable columns={columns} data={data} />
    </>
  );
};

export default SACReport;
