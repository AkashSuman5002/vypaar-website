import React, { useState, useEffect } from 'react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportFilters from '../../components/reports/common/ReportFilters';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { reportAPI } from '../../services/api';

const columns = [
  { key: 'itemName', label: 'Item Name' },
  { key: 'orderQty', label: 'Order Quantity', align: 'right' },
  { key: 'deliveredQty', label: 'Delivered Quantity', align: 'right' },
  { key: 'pendingQty', label: 'Pending Quantity', align: 'right' },
  { key: 'amount', label: 'Amount', align: 'right' },
];

const SaleOrderItem = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });
  const [period, setPeriod] = useState('this-month');

  const handleDateChange = (type, value) => {
    setDates(prev => ({ ...prev, [type]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const res = await reportAPI.getSaleOrderItem(params);
        setData(res.data.entries || []);
      } catch (err) {
        console.error('Failed to load sale order items', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dates]);

  const totalAmount = data.reduce((s, d) => s + (d.amount || 0), 0);
  const totalOrderQty = data.reduce((s, d) => s + (d.orderQty || 0), 0);
  const totalDelivered = data.reduce((s, d) => s + (d.deliveredQty || 0), 0);
  const totalPending = data.reduce((s, d) => s + (d.pendingQty || 0), 0);

  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <>
      <ReportHeader title="Sale Order Item" description="Track item-wise sale order quantities." />
      <ReportFilters search={search} onSearchChange={setSearch} period={period} onPeriodChange={setPeriod} dateStart={dates.start} dateEnd={dates.end} onDateChange={handleDateChange} />
      <div className="bg-white dark:bg-[#0F172A] min-h-full p-6 space-y-5">
        <ReportTable columns={columns} data={filteredData} emptyState="No data available. Please try again after making relevant changes." />
        <ReportSummary>
          <span className="text-gray-500 dark:text-[#64748B]">Total: <strong className="text-gray-900 dark:text-[#F8FAFC]">₹{totalAmount.toLocaleString()}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Order Qty: <strong className="text-gray-900 dark:text-[#F8FAFC]">{totalOrderQty}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Delivered: <strong className="text-gray-900 dark:text-[#F8FAFC]">{totalDelivered}</strong></span>
          <span className="text-gray-500 dark:text-[#64748B]">Pending: <strong className="text-gray-900 dark:text-[#F8FAFC]">{totalPending}</strong></span>
        </ReportSummary>
      </div>
    </>
  );
};

export default SaleOrderItem;
