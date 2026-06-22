import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/format';
import { Wallet, TrendingDown, AlertTriangle, Loader2, BarChart3 } from 'lucide-react';
import { budgetAPI } from '../../services/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const BudgetReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { year: filterYear };
      if (filterMonth) params.month = filterMonth;
      const res = await budgetAPI.getActual(params);
      setData(res.data || []);
    } catch (err) {
      toast.error('Failed to load budget report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterYear, filterMonth]);

  const summary = data.reduce((acc, b) => {
    acc.totalBudget += b.amount;
    acc.totalSpent += b.spent;
    return acc;
  }, { totalBudget: 0, totalSpent: 0 });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-[#0F172A] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Budget Report</h1>
          <div className="flex items-center gap-3">
            <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm">
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm">
              <option value="">All Months</option>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Budget', value: formatCurrency(summary.totalBudget), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Total Spent', value: formatCurrency(summary.totalSpent), icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-500/10' },
            { label: 'Remaining', value: formatCurrency(summary.totalBudget - summary.totalSpent), icon: BarChart3, color: summary.totalBudget - summary.totalSpent >= 0 ? 'text-green-600' : 'text-red-600', bg: summary.totalBudget - summary.totalSpent >= 0 ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10' },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[#64748B]">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#334155]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Period</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Budget</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Actual Spent</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Variance</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">% Used</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#64748B] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="px-5 py-12 text-center"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-500 dark:text-[#64748B]">No budget data available</td></tr>
                ) : data.map((b) => {
                  const pct = b.percentage || 0;
                  const variance = b.amount - b.spent;
                  return (
                    <tr key={b._id} className="border-b border-gray-50 dark:border-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-[#F8FAFC]">{b.category}</td>
                      <td className="px-5 py-3 text-xs text-gray-600 dark:text-[#94A3B8] capitalize">{b.period}{b.month ? ` - ${MONTHS[b.month - 1]}` : ''} {b.year}</td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">{formatCurrency(b.amount)}</td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-gray-700 dark:text-[#CBD5E1]">{formatCurrency(b.spent)}</td>
                      <td className={`px-5 py-3 text-right text-sm font-semibold ${variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(variance)}</td>
                      <td className="px-5 py-3 text-center text-sm font-bold">{pct}%</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          <div className="w-20 h-2 bg-gray-200 dark:bg-[#334155] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetReport;
