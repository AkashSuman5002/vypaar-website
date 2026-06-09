import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, TrendingUp, ShoppingBag, BookOpen, List, BarChart3,
  TrendingDown, Scale, FileText, Users, Package, RefreshCw,
  Layers, Hash, Globe, UserCheck, AlertTriangle, ClipboardList,
  Info, Activity, Landmark, Percent, Receipt, Wallet, FolderOpen,
  ShoppingCart, Banknote, ArrowUpRight, ArrowDownRight, ChevronRight,
  ArrowLeftRight, Briefcase, ScrollText, Clock, Bell, CheckCircle
} from 'lucide-react';

const sections = [
  {
    title: 'Transaction Reports', icon: ArrowLeftRight,
    items: [
      { name: 'Sale Report', route: 'sale', icon: TrendingUp },
      { name: 'Purchase Report', route: 'purchase', icon: ShoppingBag },
      { name: 'Day Book', route: 'day-book', icon: BookOpen },
      { name: 'All Transactions', route: 'all-transactions', icon: List },
      { name: 'Profit & Loss', route: 'profit-and-loss', icon: BarChart3 },
      { name: 'Cash Flow', route: 'cash-flow', icon: TrendingDown },
      { name: 'Trial Balance Report', route: 'trial-balance-report', icon: Scale },
      { name: 'Balance Sheet', route: 'balance-sheet', icon: FileText },
    ]
  },
  {
    title: 'Party Reports', icon: Users,
    items: [
      { name: 'All Parties', route: 'all-parties', icon: Users },
      { name: 'Party Statement', route: 'party-statement', icon: ScrollText },
      { name: 'Party Report By Item', route: 'party-report-by-item', icon: Package },
      { name: 'Sale Purchase By Party', route: 'sale-purchase-by-party', icon: RefreshCw },
      { name: 'Sale Purchase By Party Group', route: 'sale-purchase-by-party-group', icon: Layers },
    ]
  },
  {
    title: 'GST Reports', icon: Receipt,
    items: [
      { name: 'GSTR-1', route: 'gstr-1', icon: FileText },
      { name: 'GSTR-2', route: 'gstr-2', icon: FileText },
      { name: 'GSTR-3B', route: 'gstr-3b', icon: FileText },
      { name: 'GSTR-9', route: 'gstr-9', icon: FileText },
      { name: 'Sale Summary By HSN', route: 'sale-summary-by-hsn', icon: Hash },
      { name: 'SAC Report', route: 'sac-report', icon: Globe },
      { name: 'GSTR-2A Reconciliation', route: 'gstr-2a-reconciliation', icon: CheckCircle },
    ]
  },
  {
    title: 'Item & Stock Reports', icon: Package,
    items: [
      { name: 'Stock Summary', route: 'stock-summary', icon: Package },
      { name: 'Item Report By Party', route: 'item-report-by-party', icon: UserCheck },
      { name: 'Item Wise Profit & Loss', route: 'item-wise-profit-and-loss', icon: TrendingUp },
      { name: 'Item Category Wise Profit & Loss', route: 'item-category-wise-profit-and-loss', icon: Layers },
      { name: 'Low Stock Summary', route: 'low-stock-summary', icon: AlertTriangle },
      { name: 'Stock Detail', route: 'stock-detail', icon: ClipboardList },
      { name: 'Stock Aging', route: 'stock-aging', icon: Clock },
      { name: 'Item Detail', route: 'item-detail', icon: Info },
    ]
  },
  {
    title: 'Business Reports', icon: Briefcase,
    items: [
      { name: 'Business Status', route: 'business-status', icon: Activity },
      { name: 'Bank Statement', route: 'bank-statement', icon: Landmark },
      { name: 'Discount Report', route: 'discount-report', icon: Percent },
      { name: 'Payment Reminders', route: 'payment-reminders', icon: Bell },
    ]
  },
  {
    title: 'Taxes', icon: Landmark,
    items: [
      { name: 'GST Report', route: 'gst-report', icon: Receipt },
      { name: 'GST Rate Report', route: 'gst-rate-report', icon: Percent },
      { name: 'Form No. 27EQ', route: 'form-no.-27eq', icon: FileText },
      { name: 'TCS Receivable', route: 'tcs-receivable', icon: ArrowUpRight },
      { name: 'TDS Payable', route: 'tds-payable', icon: ArrowDownRight },
      { name: 'TDS Receivable', route: 'tds-receivable', icon: ArrowUpRight },
    ]
  },
  {
    title: 'Expense Reports', icon: Wallet,
    items: [
      { name: 'Expense Report', route: 'expense', icon: Wallet },
      { name: 'Expense Category Report', route: 'expense-category-report', icon: FolderOpen },
      { name: 'Expense Item Report', route: 'expense-item-report', icon: Package },
    ]
  },
  {
    title: 'Sale Order Reports', icon: ShoppingCart,
    items: [
      { name: 'Sale Order Report', route: 'sale-orders', icon: ShoppingCart },
      { name: 'Sale Order Status', route: 'sale-order-item', icon: ClipboardList },
      { name: 'Pending Orders', route: 'pending-orders', icon: AlertTriangle },
    ]
  },
  {
    title: 'Loan Accounts', icon: Banknote,
    items: [
      { name: 'Loan Summary', route: 'loan-summary', icon: Banknote },
      { name: 'EMI Schedule', route: 'emi-schedule', icon: FileText },
      { name: 'Loan Statement', route: 'loan-statement', icon: Banknote },
    ]
  },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' }
  })
};

let savedScrollY = 0;

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i) => ({
    opacity: 1, scale: 1,
    transition: { delay: 0.08 + i * 0.03, duration: 0.3, ease: 'easeOut' }
  })
};

const Reports = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');

  const isRoot = location.pathname === '/reports' || location.pathname === '/reports/';

  useEffect(() => {
    if (isRoot) {
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
    } else {
      savedScrollY = window.scrollY;
    }
  }, [isRoot]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map(s => ({
        ...s,
        items: s.items.filter(item => item.name.toLowerCase().includes(q))
      }))
      .filter(s => s.items.length > 0);
  }, [search]);

  if (!isRoot) {
    return <div className="h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-[#0F172A] overflow-y-auto"><Outlet /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-[#0F172A] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F8FAFC]">Reports</h1>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#64748B]" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-900 dark:text-[#F8FAFC] placeholder-gray-400 dark:placeholder-[#64748B] focus:outline-none focus:border-blue-500 dark:focus:border-[#3B82F6] focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#3B82F6] transition-colors"
            />
          </div>
        </div>

        {filteredSections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-gray-300 dark:text-[#334155] mb-4" />
            <p className="text-gray-500 dark:text-[#64748B] text-sm">No reports match "{search}"</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredSections.map((section, sIndex) => (
              <motion.div
                key={section.title}
                custom={sIndex}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <section.icon className="w-5 h-5 text-blue-600 dark:text-[#3B82F6]" />
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-[#94A3B8] uppercase tracking-wider">{section.title}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.items.map((item, iIndex) => (
                    <motion.button
                      key={item.name}
                      custom={iIndex}
                      initial="hidden"
                      animate="visible"
                      variants={cardVariants}
                      whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/reports/${item.route}`)}
                      className="flex items-center gap-4 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] rounded-2xl h-20 px-5 cursor-pointer text-left transition-colors hover:border-blue-500/30 dark:hover:border-[#3B82F6]/30"
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-[#111827] rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-[#334155]">
                        <item.icon className="w-5 h-5 text-blue-600 dark:text-[#3B82F6]" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-[#F8FAFC] leading-tight">{item.name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#64748B] flex-shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
