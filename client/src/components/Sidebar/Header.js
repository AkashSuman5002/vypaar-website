import React, { useState, useRef, useEffect } from 'react';
import { Menu, Moon, Sun, Search, Bell, User, LogOut, Settings as SettingsIcon, X, TrendingUp, ShoppingBag, BookOpen, List, BarChart3, TrendingDown, Scale, FileText, Users, Package, RefreshCw, Layers, Hash, Globe, UserCheck, AlertTriangle, ClipboardList, Info, Activity, Landmark, Percent, Receipt, Wallet, FolderOpen, ShoppingCart, Banknote, ArrowUpRight, ArrowDownRight, LayoutDashboard, ChevronRight, Clock, CheckCircle, DollarSign, CreditCard, Phone, Headphones, Building2, HelpCircle, History, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationAPI, themeAPI } from '../../services/api';
import { toast } from 'react-toastify';

const searchItems = [
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sale Report', path: '/reports/sale', icon: TrendingUp },
  { name: 'Purchase Report', path: '/reports/purchase', icon: ShoppingBag },
  { name: 'Day Book', path: '/reports/day-book', icon: BookOpen },
  { name: 'All Transactions', path: '/reports/all-transactions', icon: List },
  { name: 'Profit & Loss', path: '/reports/profit-and-loss', icon: BarChart3 },
  { name: 'Cash Flow', path: '/reports/cash-flow', icon: TrendingDown },
  { name: 'Trial Balance', path: '/reports/trial-balance-report', icon: Scale },
  { name: 'Balance Sheet', path: '/reports/balance-sheet', icon: FileText },
  { name: 'All Parties', path: '/reports/all-parties', icon: Users },
  { name: 'Stock Summary', path: '/reports/stock-summary', icon: Package },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Sales', path: '/sales', icon: TrendingUp },
  { name: 'Purchases', path: '/purchases', icon: ShoppingBag },
  { name: 'Cash & Bank', path: '/cash-bank', icon: Landmark },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
  { name: 'Support', path: '/support', icon: Headphones },
];

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    themeAPI.get().then(res => {
      setDark(res.data.darkMode === true);
      setThemeLoaded(true);
    }).catch(() => {
      setThemeLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    themeAPI.update(dark).catch(() => {});
  }, [dark, themeLoaded]);

  const removeNotification = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await notificationAPI.delete(id); } catch {}
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    try { await notificationAPI.markAllAsRead(); } catch {}
  };

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSearch = searchQuery.trim()
    ? searchItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchItems.slice(0, 8);

  const handleSearchSelect = (path) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleNotifClick = async (n) => {
    if (!n.read) {
      try { await notificationAPI.markAsRead(n._id); } catch {}
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const notifIconMap = {
    new_sale: { icon: ShoppingCart, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    new_purchase: { icon: ShoppingBag, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    payment_received: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    payment_due: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    low_stock: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    purchase_return: { icon: RefreshCw, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    sale_return: { icon: RefreshCw, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    expense_created: { icon: DollarSign, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
  };

  return (
    <>
      {/* Top Support Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 lg:px-6 h-9 flex items-center justify-between text-white text-xs z-40">
        <div className="flex items-center gap-4">
          <Link to="/company" className="flex items-center gap-1.5 hover:text-blue-100 transition-colors font-medium">
            <Building2 className="w-3.5 h-3.5" /> Company
          </Link>
          <Link to="/support" className="flex items-center gap-1.5 hover:text-blue-100 transition-colors font-medium">
            <HelpCircle className="w-3.5 h-3.5" /> Help
          </Link>
          <span onClick={() => toast.info('Current version: Vyapar Clone v1.0.0')} className="hidden md:flex items-center gap-1.5 text-blue-200 hover:text-white cursor-pointer transition-colors">
            <History className="w-3.5 h-3.5" /> Versions
          </span>
          <span onClick={() => toast.info('Shortcuts: Ctrl+K Search | Ctrl+N New Invoice | Ctrl+P Print')} className="hidden md:flex items-center gap-1.5 text-blue-200 hover:text-white cursor-pointer transition-colors">
            <Zap className="w-3.5 h-3.5" /> Shortcuts
          </span>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 hover:text-blue-100 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span className="font-medium">Customer Support</span>
          <a href="tel:+919333911911" className="flex items-center gap-1 hover:text-blue-100 transition-colors">
            <Phone className="w-3 h-3" /> +91-9333911911
          </a>
          <a href="tel:+916364444752" className="flex items-center gap-1 hover:text-blue-100 transition-colors">
            <Phone className="w-3 h-3" /> +91-6364444752
          </a>
          <Link to="/support" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full transition-colors font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Get Instant Online Support
          </Link>
        </div>
      </div>

    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-gray-700/60 px-4 lg:px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Welcome back, </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.name?.split(' ')[0] || 'User'}</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-xs text-slate-400 dark:text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block" ref={searchRef}>
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="flex items-center gap-2 px-3 h-9 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors w-56"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-2xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-gray-700 rounded">⌘K</kbd>
          </button>

          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
              >
                <div className="absolute inset-0 bg-black/40" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
                <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                    <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search pages, reports..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-gray-700">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-2xs text-slate-400 bg-slate-100 dark:bg-gray-700 rounded">ESC</kbd>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredSearch.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">No results found</p>
                    ) : (
                      filteredSearch.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => handleSearchSelect(item.path)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <item.icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <span>{item.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ml-auto" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bell className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white dark:ring-gray-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-elevated border border-slate-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button onClick={clearAllNotifications} className="text-2xs text-blue-600 dark:text-[#3B82F6] hover:underline">Clear all</button>
                    )}
                    <span className="text-2xs text-slate-400 dark:text-slate-500">{unreadCount} unread</span>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">No notifications</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => {
                      const iconDef = notifIconMap[n.type] || { icon: Bell, color: 'text-slate-600', bg: 'bg-slate-50' };
                      const Icon = iconDef.icon;
                      return (
                        <div
                          key={n._id}
                          onClick={() => handleNotifClick(n)}
                          className={`flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors border-b border-slate-50 dark:border-gray-700/50 last:border-0 group cursor-pointer ${n.read ? '' : 'bg-blue-50/30 dark:bg-blue-500/5'}`}
                        >
                          <div className={`w-8 h-8 ${iconDef.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Icon className={`w-4 h-4 ${iconDef.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-tight ${n.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100 font-medium'}`}>
                              {n.message || n.title}
                            </p>
                            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeNotification(n._id); }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                          >
                            <X className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setDark(!dark)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
        >
          {dark ? (
            <Sun className="w-4.5 h-4.5 text-amber-500" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-slate-500" />
          )}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 ml-1 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-elevated border border-slate-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
                </div>
                <div className="p-1">
                  <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                    <SettingsIcon className="w-4 h-4" />
                    Settings
                  </Link>
                  <button onClick={() => { setProfileOpen(false); logout(); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
    </>
  );
};

export default Header;
