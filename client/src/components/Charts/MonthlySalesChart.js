import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg p-3.5">
        <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
          ₹{Number(payload[0].value).toLocaleString('en-IN')}
        </p>
        {payload[0].payload.prev > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            vs prev: {payload[0].payload.prev >= 0 ? '+' : ''}{payload[0].payload.prev}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

const MonthlySalesChart = ({ data = [], title = 'Monthly Sales' }) => {
  const safeData = Array.isArray(data) ? data : [];

  const chartData = monthNames.map((name, idx) => {
    const monthNum = idx + 1;
    const found = safeData.find((d) => Number(d._id) === monthNum);
    const prev = safeData.find((d) => Number(d._id) === idx);
    return { name, sales: found ? Number(found.total) || 0 : 0, prev: prev ? Number(prev.total) || 0 : 0 };
  });

  const totalSales = chartData.reduce((s, d) => s + d.sales, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">Year to date: <span className="font-semibold text-slate-700 dark:text-slate-300">₹{totalSales.toLocaleString('en-IN')}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">Revenue</span>
          </div>
        </div>
      </div>
      <div style={{ width: '100%', height: 280, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="sales" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MonthlySalesChart;
