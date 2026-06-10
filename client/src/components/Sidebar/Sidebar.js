import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,   RotateCcw, BookCheck, Building2, ArrowRight, X,
  Zap, Truck, DollarSign, ClipboardList, ClipboardList as OrderIcon, FileDigit,
  Users, MessageCircle, Network, Receipt, Wallet, FileText, Landmark,
  Package, ShoppingCart, ChevronLeft, ChevronDown, LayoutDashboard, Search, Upload, Download, BarChart3, Settings, ScanBarcode,
  ArrowRightLeft, BookOpen, Wrench,
  FileSpreadsheet, UserPlus, Barcode, Layers, RefreshCw, ClipboardCheck, Calendar, ShieldCheck, Database,
  ScrollText, Truck as TruckIcon, Headphones,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useSettings from '../../hooks/useSettings';
import usePermissions from '../../hooks/usePermissions';

const partiesSubLinks = [
  { to: '/parties/details', label: 'Party Details', icon: Users },
  { to: '/parties/whatsapp', label: 'WhatsApp Connect', icon: MessageCircle },
  { to: '/parties/network', label: 'Vyapar Network', icon: Network },
];

const itemsSubLinks = [
  { to: '/products', label: 'Items List', icon: Package },
  { to: '/products/barcode-labels', label: 'Barcode Labels', icon: ScanBarcode },
];

const purchaseSubLinks = [
  { to: '/purchases/bills', label: 'Purchase Bills', icon: Receipt },
  { to: '/purchases/payment-out', label: 'Payment-Out', icon: Wallet },
  { to: '/purchases/expenses', label: 'Expenses', icon: FileText },
  { to: '/purchases/orders', label: 'Purchase Order', icon: ShoppingBag },
  { to: '/purchases/returns', label: 'Purchase Return / Debit Note', icon: RotateCcw },
  { to: '/party-transfer', label: 'Party Transfer', icon: ArrowRightLeft },
];

const salesSubLinks = [
  { to: '/sales', label: 'Invoice List', icon: Receipt },
  { to: '/sales/new', label: 'Create Invoice', icon: FileText },
  { to: '/sales/quick', label: 'Quick Invoice', icon: Zap },
  { to: '/sales/proforma', label: 'Proforma Invoice', icon: FileDigit },
  { to: '/sales/orders', label: 'Sale Order', icon: OrderIcon },
  { to: '/sales/payments', label: 'Payment-In', icon: DollarSign },
  { to: '/sales/challans', label: 'Delivery Challan', icon: Truck },
  { to: '/sales/returns', label: 'Sale Return / Credit Note', icon: RotateCcw },
  { to: '/sales/estimates', label: 'Estimates / Quotations', icon: FileText },
];

const cashBankSubLinks = [
  { to: '/cash-bank/accounts', label: 'Bank Accounts', icon: Landmark },
  { to: '/cash-bank/cash-in-hand', label: 'Cash In Hand', icon: BookCheck },
  { to: '/cash-bank/cheques', label: 'Cheques', icon: Wallet },
  { to: '/cash-bank/loans', label: 'Loan Accounts', icon: Building2 },
];

const accountingSubLinks = [
  { to: '/journal-entry', label: 'Journal Entries', icon: ScrollText },
  { to: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/account-statements', label: 'Account Statements', icon: FileText },
];

const userManagementSubLinks = [
  { to: '/user-management', label: 'User Management', icon: Users },
  { to: '/staff', label: 'Staff', icon: Users },
];

const utilitiesSubLinks = [
  { to: '/utilities/import-items', label: 'Import Items', icon: Upload },
  { to: '/utilities/setup-business', label: 'Set Up My Business', icon: Building2 },
  { to: '/utilities/accountant-access', label: 'Accountant Access', icon: ShieldCheck },
  { to: '/utilities/barcode-generator', label: 'Barcode Generator', icon: ScanBarcode },
  { to: '/utilities/update-items-bulk', label: 'Update Items In Bulk', icon: Layers },
  { to: '/utilities/import-tally', label: 'Import From Tally', icon: Database },
  { to: '/utilities/import-parties', label: 'Import Parties', icon: Users },
  { to: '/utilities/track-salesmen', label: 'Track Your Salesmen', icon: TruckIcon },
  { to: '/utilities/export-tally', label: 'Exports To Tally', icon: Download },
  { to: '/utilities/export-items', label: 'Export Items', icon: FileSpreadsheet },
  { to: '/utilities/verify-data', label: 'Verify My Data', icon: ClipboardCheck },
  { to: '/utilities/close-financial-year', label: 'Close Financial Year', icon: Calendar },
];

const searchItems = [
  { name: 'Home', path: '/' },
  { name: 'Parties', path: '/parties/details' },
  { name: 'Party Details', path: '/parties/details' },
  { name: 'WhatsApp Connect', path: '/parties/whatsapp' },
  { name: 'Vyapar Network', path: '/parties/network' },
  { name: 'Items', path: '/products' },
  { name: 'Items List', path: '/products' },
  { name: 'Barcode Labels', path: '/products/barcode-labels' },
  { name: 'Sale', path: '/sales' },
  { name: 'Invoice List', path: '/sales' },
  { name: 'Create Invoice', path: '/sales/new' },
  { name: 'Quick Invoice', path: '/sales/quick' },
  { name: 'Sale Return', path: '/sales/returns' },
  { name: 'Credit Note', path: '/sales/returns' },
  { name: 'Delivery Challan', path: '/sales/challans' },
  { name: 'Estimates', path: '/sales/estimates' },
  { name: 'Quotations', path: '/sales/estimates' },
  { name: 'Proforma Invoice', path: '/sales/proforma' },
  { name: 'Sale Order', path: '/sales/orders' },
  { name: 'Payment-In', path: '/sales/payments' },
  { name: 'Payments', path: '/sales/payments' },
  { name: 'Purchase Bills', path: '/purchases/bills' },
  { name: 'Payment-Out', path: '/purchases/payment-out' },
  { name: 'Expenses', path: '/purchases/expenses' },
  { name: 'Purchase Order', path: '/purchases/orders' },
  { name: 'Purchase Return', path: '/purchases/returns' },
  { name: 'Cash & Bank', path: '/cash-bank/accounts' },
  { name: 'Bank Accounts', path: '/cash-bank/accounts' },
  { name: 'Cash In Hand', path: '/cash-bank/cash-in-hand' },
  { name: 'Cheques', path: '/cash-bank/cheques' },
  { name: 'Loan Accounts', path: '/cash-bank/loans' },
  { name: 'Accounting', path: '/journal-entry' },
  { name: 'Journal Entries', path: '/journal-entry' },
  { name: 'Chart of Accounts', path: '/chart-of-accounts' },
  { name: 'Account Statements', path: '/account-statements' },
  { name: 'Fixed Assets', path: '/chart-of-accounts' },
  { name: 'Party to Party Transfer', path: '/party-transfer' },
  { name: 'User Management', path: '/user-management' },
  { name: 'Utilities', path: '/utilities/import-items' },
  { name: 'Import Items', path: '/utilities/import-items' },
  { name: 'Set Up My Business', path: '/utilities/setup-business' },
  { name: 'Accountant Access', path: '/utilities/accountant-access' },
  { name: 'Barcode Generator', path: '/utilities/barcode-generator' },
  { name: 'Update Items In Bulk', path: '/utilities/update-items-bulk' },
  { name: 'Import From Tally', path: '/utilities/import-tally' },
  { name: 'Import Parties', path: '/utilities/import-parties' },
  { name: 'Track Your Salesmen', path: '/utilities/track-salesmen' },
  { name: 'Exports To Tally', path: '/utilities/export-tally' },
  { name: 'Export Items', path: '/utilities/export-items' },
  { name: 'Verify My Data', path: '/utilities/verify-data' },
  { name: 'Close Financial Year', path: '/utilities/close-financial-year' },
  { name: 'Calendar', path: '/calendar' },
  { name: 'Staff', path: '/staff' },
  { name: 'Reports', path: '/reports' },
  { name: 'Settings', path: '/settings' },
];

const NavItem = ({ to, label, icon: Icon, collapsed, onClick, children }) => {
  const location = useLocation();
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  if (collapsed) {
    return (
      <div className="relative group flex items-center justify-center">
        {children ? (
          <button onClick={onClick} className="flex items-center justify-center w-full h-12 text-white/70 hover:text-white transition-colors">
            <Icon size={20} />
          </button>
        ) : (
          <NavLink to={to} onClick={onClick} className="flex items-center justify-center w-full h-12 text-white/70 hover:text-white transition-colors">
            <Icon size={20} />
          </NavLink>
        )}
        <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#2A2D61] text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {children ? (
        <button onClick={onClick} className={`flex items-center gap-3 w-full h-12 px-4 text-[15px] font-medium transition-colors duration-200 ${isActive ? 'text-white' : 'text-[#C7D2FE] hover:text-white'}`} style={isActive ? { backgroundColor: '#2A2D61' } : {}}>
          {isActive && <span className="absolute left-0 w-1 h-full bg-red-500" />}
          <Icon size={20} className="flex-shrink-0" />
          <span className="flex-1 text-left">{label}</span>
          {children}
        </button>
      ) : (
        <NavLink to={to} onClick={onClick} className="flex items-center gap-3 w-full h-12 px-4 text-[15px] font-medium transition-colors duration-200" style={({ isActive }) => ({ color: isActive ? '#FFFFFF' : '#C7D2FE', backgroundColor: isActive ? '#2A2D61' : 'transparent' })}>
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 w-1 h-full bg-red-500" />}
              <Icon size={20} className="flex-shrink-0" style={{ color: isActive ? '#FFFFFF' : '#C7D2FE' }} />
              <span className="flex-1 text-left">{label}</span>
            </>
          )}
        </NavLink>
      )}
    </div>
  );
};

const SubNavItem = ({ to, label, icon: Icon, collapsed, onClick }) => {
  if (collapsed) return null;
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 mx-3 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive ? 'text-white' : 'text-[#C7D2FE] hover:text-white hover:bg-[#34387A]'}`
      }
      style={({ isActive }) => isActive ? { backgroundColor: '#2A2D61' } : {}}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className="flex-shrink-0 opacity-70" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
};

const Sidebar = ({ open, setOpen, collapsed, setCollapsed }) => {
  const { user } = useAuth();
  const { settings, getPref } = useSettings();
  const { canAccess, isAdmin, isOwner, isStaff } = usePermissions();
  const estEnabled = getPref('general', 'estimateQuotation') !== false;
  const profEnabled = getPref('general', 'proformaInvoice') !== false;
  const orderEnabled = getPref('general', 'salePurchaseOrder') !== false;
  const dcEnabled = getPref('general', 'deliveryChallan') !== false;
  const otherIncomeEnabled = getPref('general', 'otherIncome') !== false;
  const fixedAssetsEnabled = getPref('general', 'fixedAssets') === true;
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [partiesOpen, setPartiesOpen] = useState(location.pathname.startsWith('/parties'));
  const [salesOpen, setSalesOpen] = useState(location.pathname.startsWith('/sales'));
  const [purchasesOpen, setPurchasesOpen] = useState(location.pathname.startsWith('/purchases'));
  const [cashBankOpen, setCashBankOpen] = useState(location.pathname.startsWith('/cash-bank'));
  const [itemsOpen, setItemsOpen] = useState(location.pathname.startsWith('/products'));
  const [accountingOpen, setAccountingOpen] = useState(location.pathname.startsWith('/journal-entry') || location.pathname.startsWith('/chart-of-accounts') || location.pathname.startsWith('/account-statements'));
  const [utilitiesOpen, setUtilitiesOpen] = useState(location.pathname.startsWith('/utilities'));
  const [userManagementOpen, setUserManagementOpen] = useState(location.pathname.startsWith('/user-management') || location.pathname.startsWith('/staff'));

  useEffect(() => {
    setPartiesOpen(location.pathname.startsWith('/parties'));
    setSalesOpen(location.pathname.startsWith('/sales'));
    setPurchasesOpen(location.pathname.startsWith('/purchases'));
    setCashBankOpen(location.pathname.startsWith('/cash-bank'));
    setItemsOpen(location.pathname.startsWith('/products'));
    setAccountingOpen(location.pathname.startsWith('/journal-entry') || location.pathname.startsWith('/chart-of-accounts') || location.pathname.startsWith('/account-statements'));
    setUtilitiesOpen(location.pathname.startsWith('/utilities'));
    setUserManagementOpen(location.pathname.startsWith('/user-management') || location.pathname.startsWith('/staff'));
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        inputRef.current?.blur();
        setSearchFocused(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const docSearchFilter = (item) => {
    if (!estEnabled && (item.name === 'Estimates' || item.name === 'Quotations' || item.path === '/sales/estimates')) return false;
    if (!profEnabled && (item.name === 'Proforma Invoice' || item.path === '/sales/proforma')) return false;
    if (!orderEnabled && (item.name === 'Sale Order' || item.name === 'Purchase Order' || item.path === '/sales/orders' || item.path === '/purchases/orders')) return false;
    if (!dcEnabled && (item.name === 'Delivery Challan' || item.path === '/sales/challans')) return false;
    return true;
  };
  const filteredSearch = searchQuery.trim()
    ? searchItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) && docSearchFilter(item))
    : [];

  const handleSearchSelect = (path) => {
    setSearchQuery('');
    setSearchFocused(false);
    inputRef.current?.blur();
    if (window.innerWidth < 1024) setOpen(false);
    navigate(path);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? 'w-[72px]' : 'w-[280px]'
        } ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ backgroundColor: '#0B0D2B' }}
      >
        {/* Top Section: Search + Collapse */}
        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          {/* Search Box */}
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-[#24285B] text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <Search size={18} />
            </button>
          ) : (
            <div className="relative flex-1" ref={searchRef}>
              <div className="flex items-center h-11 rounded-full bg-[#24285B] px-4 gap-2.5">
                <Search size={18} className="text-[#C7D2FE] flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Open Anything (Ctrl+F)"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
                  onFocus={() => setSearchFocused(true)}
                  className="flex-1 bg-transparent text-sm text-white placeholder-[#C7D2FE]/70 focus:outline-none min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                    <X size={14} className="text-[#C7D2FE]" />
                  </button>
                )}
              </div>
              <AnimatePresence>
                {searchFocused && searchQuery && filteredSearch.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-[#1E2156] rounded-xl border border-[#3B3F73] overflow-hidden shadow-xl z-50"
                  >
                    {filteredSearch.map((item) => (
                      <button
                        key={item.path + item.name}
                        onClick={() => handleSearchSelect(item.path)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#C7D2FE] hover:text-white hover:bg-[#2A2D61] transition-colors text-left"
                      >
                        <ArrowRight size={14} className="opacity-50" />
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#3B3F73] text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft size={18} />
            </motion.div>
          </button>
        </div>

        {/* Mobile close */}
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={18} className="text-[#C7D2FE]" />
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-1 space-y-0.5">
          {/* Home */}
          <NavItem to="/" label="Home" icon={LayoutDashboard} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />

          {/* Divider */}
          {!collapsed && <div className="h-px bg-white/5 mx-4 my-1" />}

          {/* Parties */}
          {canAccess.customers && (
          <NavItem to="/parties" label="Parties" icon={Users} collapsed={collapsed} onClick={() => setPartiesOpen(!partiesOpen)}>
            <motion.div animate={{ rotate: partiesOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && canAccess.customers && (
            <AnimatePresence>
              {partiesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {partiesSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Items */}
          {getPref('item', 'enableItem') !== false && canAccess.products && (
          <NavItem to="/products" label="Items" icon={Package} collapsed={collapsed} onClick={() => setItemsOpen(!itemsOpen)}>
            <motion.div animate={{ rotate: itemsOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && getPref('item', 'enableItem') !== false && canAccess.products && (
            <AnimatePresence>
              {itemsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {itemsSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Sale */}
          {canAccess.sales && (
          <NavItem to="/sales" label="Sale" icon={ShoppingCart} collapsed={collapsed} onClick={() => setSalesOpen(!salesOpen)}>
            <motion.div animate={{ rotate: salesOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && canAccess.sales && (
            <AnimatePresence>
              {salesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {salesSubLinks.filter(link => {
                      if (link.label === 'Proforma Invoice' && !profEnabled) return false;
                      if (link.label === 'Sale Order' && !orderEnabled) return false;
                      if (link.label === 'Delivery Challan' && !dcEnabled) return false;
                      if ((link.label === 'Estimates / Quotations' || link.to === '/sales/estimates') && !estEnabled) return false;
                      return true;
                    }).map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Purchase & Expense */}
          {canAccess.purchases && (
          <NavItem to="/purchases" label="Purchase & Expense" icon={ClipboardList} collapsed={collapsed} onClick={() => setPurchasesOpen(!purchasesOpen)}>
            <motion.div animate={{ rotate: purchasesOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && canAccess.purchases && (
            <AnimatePresence>
              {purchasesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {purchaseSubLinks.filter(link => {
                      if (link.label === 'Purchase Order' && !orderEnabled) return false;
                      return true;
                    }).map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Cash & Bank */}
          {canAccess.cashbank && (
          <NavItem to="/cash-bank" label="Cash & Bank" icon={Landmark} collapsed={collapsed} onClick={() => setCashBankOpen(!cashBankOpen)}>
            <motion.div animate={{ rotate: cashBankOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && canAccess.cashbank && (
            <AnimatePresence>
              {cashBankOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {cashBankSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Accounting */}
          {getPref('accounting', 'enableAccounting') !== false && canAccess.accounting && (
          <NavItem to="/journal-entry" label="Accounting" icon={BookOpen} collapsed={collapsed} onClick={() => setAccountingOpen(!accountingOpen)}>
            <motion.div animate={{ rotate: accountingOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && getPref('accounting', 'enableAccounting') !== false && canAccess.accounting && (
            <AnimatePresence>
              {accountingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {accountingSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                    {fixedAssetsEnabled && (
                      <SubNavItem to="/chart-of-accounts" label="Fixed Assets" icon={Building2} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Calendar */}
          <NavItem to="/calendar" label="Calendar" icon={Calendar} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />

          {/* User Management */}
          {canAccess.users && (
          <NavItem to="/user-management" label="User Management" icon={Users} collapsed={collapsed} onClick={() => setUserManagementOpen(!userManagementOpen)}>
            <motion.div animate={{ rotate: userManagementOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>
          )}

          {!collapsed && canAccess.users && (
            <AnimatePresence>
              {userManagementOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {userManagementSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Divider */}
          {!collapsed && <div className="h-px bg-white/5 mx-4 my-1" />}

          {/* Utilities */}
          <NavItem to="/utilities/import-items" label="Utilities" icon={Wrench} collapsed={collapsed} onClick={() => setUtilitiesOpen(!utilitiesOpen)}>
            <motion.div animate={{ rotate: utilitiesOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-[#C7D2FE]/70" />
            </motion.div>
          </NavItem>

          {!collapsed && (
            <AnimatePresence>
              {utilitiesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-1 space-y-0.5">
                    {utilitiesSubLinks.map((link) => (
                      <SubNavItem key={link.to} to={link.to} label={link.label} icon={link.icon} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Reports */}
          {getPref('accounting', 'enableAccounting') !== false && canAccess.reports && (
          <NavItem to="/reports" label="Reports" icon={BarChart3} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
          )}
          {getPref('accounting', 'enableAccounting') !== false && canAccess.reports && fixedAssetsEnabled && (
          <NavItem to="/reports?tab=fixed-assets" label="Fixed Assets Report" icon={Building2} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
          )}

          {/* Settings */}
          {canAccess.settings && (
          <NavItem to="/settings" label="Settings" icon={Settings} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
          )}

          {/* Support */}
          <NavItem to="/support" label="Support" icon={Headphones} collapsed={collapsed} onClick={() => { if (window.innerWidth < 1024) setOpen(false); }} />
        </nav>

        {/* Bottom: Company Switcher */}
        {!collapsed ? (
          <div className="px-3 pb-4 pt-2 mt-auto">
            <div onClick={() => navigate('/edit-profile')} className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: '#23285A' }}>
              <div className="w-8 h-8 rounded-lg bg-[#3B3F73] flex items-center justify-center flex-shrink-0">
                {settings?.logo ? (
                  <img src={settings.logo} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Building2 size={16} className="text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{settings?.businessName || user?.name + "'s Business" || 'My Company'}</p>
                <p className="text-xs text-[#C7D2FE]/70 truncate">{user?.email || ''}</p>
              </div>
              <ArrowRight size={16} className="text-[#C7D2FE]/50 flex-shrink-0" />
            </div>
          </div>
        ) : (
          <div className="px-3 pb-4 pt-2 mt-auto">
            <div onClick={() => navigate('/edit-profile')} className="flex items-center justify-center w-full py-3 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: '#23285A' }}>
              <Building2 size={20} className="text-white/70" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
