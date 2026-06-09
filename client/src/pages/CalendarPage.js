import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, ShoppingCart, ClipboardList,
  DollarSign, X, Loader2,
} from 'lucide-react';
import { saleAPI, purchaseAPI, expenseAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const CalendarPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = new Date(year, month, 1).toISOString().split('T')[0];
      const dateTo = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const [salesRes, purchaseRes, expenseRes] = await Promise.all([
        saleAPI.getAll({ dateFrom, dateTo, limit: 500 }).catch(() => ({ data: { sales: [] } })),
        purchaseAPI.getAll({ dateFrom, dateTo, limit: 500 }).catch(() => ({ data: { purchases: [] } })),
        expenseAPI.getAll({ dateFrom, dateTo, limit: 500 }).catch(() => ({ data: { expenses: [] } })),
      ]);
      setSales(salesRes.data?.sales || []);
      setPurchases(purchaseRes.data?.purchases || []);
      setExpenses(expenseRes.data?.expenses || []);
    } catch (err) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const getTransactionsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const daySales = sales.filter(s => {
      const d = new Date(s.date).toISOString().split('T')[0];
      return d === dateStr;
    });
    const dayPurchases = purchases.filter(p => {
      const d = new Date(p.date).toISOString().split('T')[0];
      return d === dateStr;
    });
    const dayExpenses = expenses.filter(e => {
      const d = new Date(e.date).toISOString().split('T')[0];
      return d === dateStr;
    });
    return { sales: daySales, purchases: dayPurchases, expenses: dayExpenses };
  };

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); };
  const goToToday = () => { setCurrentDate(new Date()); };

  const handleDayClick = (day) => {
    const txns = getTransactionsForDay(day);
    setSelectedDay({ day, ...txns });
    setShowModal(true);
  };

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const totalSales = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const totalPurchases = purchases.reduce((s, p) => s + (p.total || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);

  if (loading && sales.length === 0 && purchases.length === 0 && expenses.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">View all transactions on a calendar</p>
        </motion.div>
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12 lg:p-16 flex items-center justify-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">View all transactions on a calendar</p>
        </div>
        <button onClick={goToToday}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        ><CalendarIcon className="w-4 h-4" /> Today</button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><ShoppingCart className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sales</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalSales)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-xl"><ClipboardList className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Purchases</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalPurchases)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-xl"><DollarSign className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Expenses</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          ><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={nextMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          ><ChevronRight className="w-5 h-5 text-slate-600" /></button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-gray-700 rounded-xl overflow-hidden">
          {WEEKDAYS.map(day => (
            <div key={day} className="bg-slate-50 dark:bg-gray-800 p-2 text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">{day}</span>
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-white dark:bg-gray-800 p-2 min-h-[80px]" />;
            const txns = getTransactionsForDay(day);
            const hasSales = txns.sales.length > 0;
            const hasPurchases = txns.purchases.length > 0;
            const hasExpenses = txns.expenses.length > 0;
            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
            const totalCount = txns.sales.length + txns.purchases.length + txns.expenses.length;

            return (
              <div key={day}
                onClick={() => totalCount > 0 && handleDayClick(day)}
                className={`bg-white dark:bg-gray-800 p-2 min-h-[80px] ${totalCount > 0 ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700' : ''} transition-colors`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700 dark:text-slate-300'}`}>
                    {day}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {hasSales && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-blue-600 font-medium">{txns.sales.length} sale{txns.sales.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {hasPurchases && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      <span className="text-[10px] text-orange-600 font-medium">{txns.purchases.length} purch</span>
                    </div>
                  )}
                  {hasExpenses && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[10px] text-red-600 font-medium">{txns.expenses.length} exp</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs text-slate-600">Sales</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-xs text-slate-600">Purchases</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-slate-600">Expenses</span></div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && selectedDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {new Date(year, month, selectedDay.day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
                {selectedDay.sales.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" /> Sales ({selectedDay.sales.length})
                    </h4>
                    <div className="space-y-1.5">
                      {selectedDay.sales.map(s => (
                        <div key={s._id} className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{s.invoiceNumber || s._id?.slice(-6)}</p>
                            <p className="text-xs text-slate-500">{s.customerName || 'Walk-in'}</p>
                          </div>
                          <span className="text-sm font-bold text-blue-700">{formatCurrency(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDay.purchases.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Purchases ({selectedDay.purchases.length})
                    </h4>
                    <div className="space-y-1.5">
                      {selectedDay.purchases.map(p => (
                        <div key={p._id} className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{p.invoiceNumber || p._id?.slice(-6)}</p>
                            <p className="text-xs text-slate-500">{p.supplierName || 'Supplier'}</p>
                          </div>
                          <span className="text-sm font-bold text-orange-700">{formatCurrency(p.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDay.expenses.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Expenses ({selectedDay.expenses.length})
                    </h4>
                    <div className="space-y-1.5">
                      {selectedDay.expenses.map(e => (
                        <div key={e._id} className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{e.category || 'Expense'}</p>
                            <p className="text-xs text-slate-500">{e.description || e.expenseNumber}</p>
                          </div>
                          <span className="text-sm font-bold text-red-700">{formatCurrency(e.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDay.sales.length === 0 && selectedDay.purchases.length === 0 && selectedDay.expenses.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No transactions on this day.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CalendarPage;
