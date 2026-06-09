import React, { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '../services/api';
import StatCard from '../components/UI/StatCard';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import MonthlySalesChart from '../components/Charts/MonthlySalesChart';
import { formatCurrency, formatDate } from '../utils/format';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, ClipboardList, TrendingUp, Wallet,
  Landmark, AlertTriangle, Users, Package,
  ArrowUpRight, Clock, CreditCard,
  BarChart3, CheckCircle, XCircle, DollarSign,
  Eye, ArrowRight, Plus, FileText,
} from 'lucide-react';
import usePermissions from '../hooks/usePermissions';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();
  const [businessKey, setBusinessKey] = useState(localStorage.getItem('activeBusiness'));
  const { canAccess, canSeeFinancials, canSeeCostPrice, isStaff } = usePermissions();

  useEffect(() => {
    const handleStorage = () => {
      setBusinessKey(localStorage.getItem('activeBusiness'));
    };
    const handleBusinessSwitch = () => {
      setBusinessKey(localStorage.getItem('activeBusiness'));
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('business-switched', handleBusinessSwitch);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('business-switched', handleBusinessSwitch);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await dashboardAPI.getData();
        setData(data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [businessKey]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setQuickOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setQuickOpen(false);
        return;
      }
      if (!e.altKey || quickOpen) return;
      const key = e.key.toUpperCase();
      for (const group of filteredQuickActions) {
        for (const action of group.items) {
          if (action.shortcut === key) {
            e.preventDefault();
            navigate(action.to);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, quickOpen]);

  const filteredQuickActions = [
    { section: 'SALE', items: [
      ...(canAccess.salesCreate ? [
        { label: 'Sale Invoice', shortcut: 'S', to: '/sales/new' },
        { label: 'Payment-In', shortcut: 'I', to: '/sales/payments' },
        { label: 'Sale Return', shortcut: 'R', to: '/sales/returns' },
      ] : []),
      ...(canAccess.sales ? [
        { label: 'Sale Order', shortcut: 'F', to: '/sales/orders' },
        { label: 'Estimate/Quotation', shortcut: 'M', to: '/sales/estimates' },
        { label: 'Proforma Invoice', shortcut: 'K', to: '/sales/proforma' },
        { label: 'Delivery Challan', shortcut: 'D', to: '/sales/challans' },
      ] : []),
    ]},
    { section: 'PURCHASE', items: [
      ...(canAccess.purchasesCreate ? [
        { label: 'Purchase Bill', shortcut: 'P', to: '/purchases/bills' },
        { label: 'Payment-Out', shortcut: 'O', to: '/purchases/payment-out' },
        { label: 'Purchase Return', shortcut: 'L', to: '/purchases/returns' },
      ] : []),
      ...(canAccess.purchases ? [
        { label: 'Purchase Order', shortcut: 'G', to: '/purchases/orders' },
      ] : []),
    ]},
    { section: 'OTHERS', items: [
      ...(canAccess.expensesCreate ? [
        { label: 'Expenses', shortcut: 'E', to: '/purchases/expenses' },
      ] : []),
      ...(canAccess.customersManage ? [
        { label: 'Party To Party Transfer', shortcut: 'J', to: '/party-transfer' },
      ] : []),
      ...(canAccess.accounting ? [
        { label: 'Journal Entry', shortcut: 'X', to: '/journal-entry' },
      ] : []),
      ...(canAccess.users ? [
        { label: 'User Management', shortcut: 'U', to: '/user-management' },
      ] : []),
    ]},
  ];

  if (loading) return <LoadingSpinner fullPage />;

  const lowStockCount = data?.lowStockProducts?.length || 0;
  const pendingCount = data?.pendingInvoices || 0;
  const overdueCount = data?.overdueInvoices || 0;
  const recentActivity = data?.recentActivity || [];

  const activityColor = (status) => {
    if (status === 'paid') return 'bg-emerald-500';
    if (status === 'partial') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const activityBg = (status) => {
    if (status === 'paid') return 'bg-emerald-50 dark:bg-emerald-500/10';
    if (status === 'partial') return 'bg-amber-50 dark:bg-amber-500/10';
    return 'bg-red-50 dark:bg-red-500/10';
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your business at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 shadow-soft">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
          {overdueCount > 0 && (
            <Link to="/sales" className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-1.5 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} overdue
            </Link>
          )}
          {canAccess.salesCreate && (
          <Link to="/sales/new"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 shadow-sm transition-all"
          ><ShoppingCart className="w-3.5 h-3.5" /> Add Sale</Link>
          )}
          {canAccess.purchasesCreate && (
          <Link to="/purchases/bills"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-1.5 shadow-sm transition-all"
          ><ClipboardList className="w-3.5 h-3.5" /> Add Purchase</Link>
          )}
          {canAccess.salesCreate && (
          <Link to="/sales/quick"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 shadow-sm transition-all"
          ><FileText className="w-3.5 h-3.5" /> Create Invoice</Link>
          )}
          <div className="relative">
            <button onClick={() => setQuickOpen(!quickOpen)}
              className="flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95"
              title="Quick Actions (Ctrl+Enter)"
            >
              <Plus className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {quickOpen && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40" onClick={() => setQuickOpen(false)}
                  />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }} transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-gray-700/80 overflow-hidden"
                  >
                    <div className="max-h-[70vh] overflow-y-auto py-2">
                      {filteredQuickActions.filter(g => g.items.length > 0).map((group) => (
                        <div key={group.section}>
                          <div className="px-4 pt-3 pb-1 text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{group.section}</div>
                          {group.items.map((action) => (
                            <button key={action.label}
                              onClick={() => { navigate(action.to); setQuickOpen(false); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                              <span>{action.label}</span>
                              <kbd className="text-2xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-600">ALT+{action.shortcut}</kbd>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 dark:border-gray-700 px-4 py-2 text-2xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
                      <span>Ctrl+Enter to open</span>
                      <span>ESC to close</span>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canAccess.sales && (
        <StatCard title="Total Sales" value={formatCurrency(data?.totalSales)} icon={ShoppingCart} color="blue" to="/sales" trend={data?.trends?.sales} />
        )}
        {canAccess.purchases && (
        <StatCard title="Total Purchases" value={formatCurrency(data?.totalPurchases)} icon={ClipboardList} color="orange" to="/purchases" trend={data?.trends?.purchases} />
        )}
        {canSeeFinancials && (
        <StatCard title="Net Profit" value={formatCurrency(data?.netProfit)} icon={TrendingUp} color="green" to="/reports/profit-and-loss" trend={data?.trends?.profit} />
        )}
        {canSeeFinancials && (
        <StatCard title="Pending Dues" value={formatCurrency(data?.pendingDuesTotal)} icon={AlertTriangle} color="red" subtitle={`${pendingCount} invoices`} to="/sales" />
        )}
        {canAccess.cashbank && (
        <StatCard title="Cash Balance" value={formatCurrency(data?.cashBalance)} icon={Wallet} color="cyan" to="/cash-bank/cash-in-hand" />
        )}
        {canAccess.cashbank && (
        <StatCard title="Bank Balance" value={formatCurrency(data?.bankBalance)} icon={Landmark} color="indigo" to="/cash-bank/accounts" />
        )}
        {canAccess.customers && (
        <StatCard title="Total Customers" value={data?.totalCustomers || 0} icon={Users} color="purple" to="/customers" />
        )}
        {canAccess.products && (
        <StatCard title="Total Products" value={data?.totalProducts || 0} icon={Package} color="blue" to="/products" />
        )}
      </motion.div>

      {/* Alerts */}
      {lowStockCount > 0 && (
        <motion.div variants={item}>
          <Link to="/products" className="group block bg-white dark:bg-gray-800 rounded-2xl border border-red-200/60 dark:border-red-900/50 shadow-soft hover:shadow-card-hover transition-all p-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Low Stock Alert</p>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-red-400 transition-colors" />
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">{lowStockCount} product{lowStockCount > 1 ? 's' : ''} running low</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {data.lowStockProducts.slice(0, 4).map((p, i) => (
                    <p key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="truncate">{p.name}</span>
                      <span className="font-medium flex-shrink-0">{p.stock} left</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Chart + Inventory */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2" style={{ minWidth: 0 }}>
          <MonthlySalesChart data={data?.monthlySales} />
        </div>
        <div className="space-y-4">
          {/* Inventory Valuation */}
          {canSeeCostPrice && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventory Valuation</h3>
            </div>
            <div className="space-y-3.5">
              <div>
                <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">At Cost Price</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(data?.inventoryValue || 0)}</p>
              </div>
              <div className="border-t border-slate-100 dark:border-gray-700 pt-3.5">
                <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">At Selling Price</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(data?.inventoryValueAtPrice || 0)}</p>
              </div>
              <div className="border-t border-slate-100 dark:border-gray-700 pt-3.5">
                <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Potential Profit</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency((data?.inventoryValueAtPrice || 0) - (data?.inventoryValue || 0))}
                </p>
              </div>
              <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-2">
                View Inventory <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          )}
          {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
            <Link to="/products" className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 hover:shadow-card-hover transition-shadow cursor-pointer block">
              <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Products</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{data?.totalProducts || 0}</p>
            </Link>
            <Link to="/customers" className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 hover:shadow-card-hover transition-shadow cursor-pointer block">
              <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customers</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{data?.totalCustomers || 0}</p>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Activity + Recent Transactions */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Activity Timeline</h3>
            </div>
            <Link to="/sales" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">View all</Link>
          </div>
          <div className="space-y-0 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((a, i) => (
                <Link key={a._id || i} to={`/sales/${a._id}`} className="flex gap-3 pb-4 relative group">
                  {i < recentActivity.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-gray-700 group-hover:bg-blue-300 dark:group-hover:bg-blue-800 transition-colors" />
                  )}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activityBg(a.paymentStatus)}`}>
                    {a.paymentStatus === 'paid' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : a.paymentStatus === 'partial' ? (
                      <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {a.customerName || 'Walk-in Customer'}
                      </p>
                      <span className="text-2xs text-slate-400 dark:text-slate-500 flex-shrink-0 font-medium">{formatDate(a.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{a.invoiceNumber}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className={`text-xs font-semibold ${
                        a.paymentStatus === 'paid' ? 'text-emerald-600 dark:text-emerald-400' :
                        a.paymentStatus === 'partial' ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(a.totalAmount)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h3>
            </div>
            <Link to="/cash-bank" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">View all</Link>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 dark:border-gray-700">
                  <th className="px-5 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Invoice</th>
                  <th className="px-5 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-5 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:table-cell">Date</th>
                  <th className="px-5 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {data?.recentTransactions?.map((t) => (
                  <tr key={t._id} onClick={() => navigate(`/sales/${t._id}`)} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/20 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">{t.invoiceNumber}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{t.customerName || 'Walk-in'}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{formatDate(t.date)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(t.totalAmount)}</td>
                  </tr>
                ))}
                {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">No recent transactions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
