import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/format';
import { chartOfAccountsAPI } from '../services/api';
import {
  Plus, Search, ChevronDown, ChevronRight, Info, X, Save,
  Loader2, MoreVertical, Edit2, Trash2, Lock, Eye, Filter,
} from 'lucide-react';

const TYPE_CONFIG = [
  { key: 'asset', label: 'Assets', types: ['asset'], color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { key: 'equity_liability', label: 'Equities & Liabilities', types: ['equity', 'liability'], color: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { key: 'income', label: 'Incomes', types: ['income'], color: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  { key: 'expense', label: 'Expenses', types: ['expense'], color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
];

const SIDEBAR_TREE = {
  asset: [
    { code: '1300', label: 'Fixed Assets' },
    { code: '1350', label: 'Non Current Assets' },
    { code: '1000', label: 'Current Assets', children: [
      { code: '1100', label: 'Sundry Debtors' },
      { code: '1150', label: 'Input Duties & Taxes', children: [
        { code: '1160', label: 'Input GST' },
      ]},
      { code: '1020', label: 'Bank Accounts' },
      { code: '1010', label: 'Cash Accounts' },
      { code: '1800', label: 'Other Current Assets' },
    ]},
    { code: '1900', label: 'Other Assets' },
  ],
  equity_liability: [
    { code: '3000', label: 'Capital Account', children: [
      { code: '3002', label: 'Reserves & Surplus' },
    ]},
    { code: '2200', label: 'Long-term Liabilities' },
    { code: '2000', label: 'Current Liabilities', children: [
      { code: '2001', label: 'Sundry Creditors' },
      { code: '2100', label: 'Outward Duties & Taxes', children: [
        { code: '2110', label: 'Output GST' },
      ]},
      { code: '2800', label: 'Other Current Liabilities' },
    ]},
    { code: '2900', label: 'Other Liabilities' },
  ],
  income: [
    { code: '4000', label: 'Sale Accounts' },
    { code: '4100', label: 'Other Incomes (Direct)' },
    { code: '4200', label: 'Other Incomes (Indirect)' },
  ],
  expense: [
    { code: '5000', label: 'Purchase Accounts' },
    { code: '5100', label: 'Direct Expenses' },
    { code: '5200', label: 'Indirect Expenses' },
  ],
};

const CHART_CATEGORIES = {
  asset: [
    { value: 'fixed_asset', label: 'Fixed Asset' },
    { value: 'non_current_asset', label: 'Non Current Asset' },
    { value: 'current_asset', label: 'Current Asset' },
    { value: 'other_asset', label: 'Other Asset' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Bank' },
    { value: 'receivable', label: 'Sundry Debtors' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'gst_collectible', label: 'GST Collectible' },
    { value: 'input_duties', label: 'Input Duties & Taxes' },
  ],
  liability: [
    { value: 'current_liability', label: 'Current Liability' },
    { value: 'long_term_liability', label: 'Long-term Liability' },
    { value: 'loan', label: 'Loan' },
    { value: 'payable', label: 'Sundry Creditors' },
    { value: 'gst_payable', label: 'GST Payable' },
    { value: 'tax_payable', label: 'Tax Payable' },
    { value: 'output_duties', label: 'Output Duties & Taxes' },
  ],
  equity: [
    { value: 'capital', label: 'Capital' },
    { value: 'retained_earnings', label: 'Retained Earnings' },
    { value: 'drawings', label: 'Drawings' },
  ],
  income: [
    { value: 'sales', label: 'Sales' },
    { value: 'other_income', label: 'Other Income' },
    { value: 'direct_income', label: 'Direct Income' },
    { value: 'indirect_income', label: 'Indirect Income' },
  ],
  expense: [
    { value: 'purchase', label: 'Purchase' },
    { value: 'direct_expense', label: 'Direct Expense' },
    { value: 'indirect_expense', label: 'Indirect Expense' },
  ],
};

const CATEGORY_LABELS = {};
Object.values(CHART_CATEGORIES).forEach(cats => {
  cats.forEach(c => { CATEGORY_LABELS[c.value] = c.label; });
});

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTypes, setExpandedTypes] = useState({ asset: true, equity_liability: false, income: false, expense: false });
  const [expandedCodes, setExpandedCodes] = useState({});
  const [highlightCode, setHighlightCode] = useState(null);
  const [allExpanded, setAllExpanded] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);

  const [form, setForm] = useState({
    name: '', type: 'asset', category: 'current_asset', code: '', description: '', parent: '', balance: 0,
  });

  const fetchAccounts = async () => {
    try {
      const { data } = await chartOfAccountsAPI.getAll();
      setAccounts(data);
    } catch (err) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const codeToAccount = useMemo(() => {
    const map = {};
    accounts.forEach(a => { if (a.code) map[a.code] = a; });
    return map;
  }, [accounts]);

  const childMap = useMemo(() => {
    const map = {};
    accounts.forEach(a => {
      const pid = a.parent;
      if (pid) {
        if (!map[pid]) map[pid] = [];
        map[pid].push(a);
      }
    });
    return map;
  }, [accounts]);

  const getChildAccounts = (accountId) => childMap[accountId] || [];

  const getGroupBalance = (account) => {
    const children = getChildAccounts(account._id);
    if (children.length === 0) return account.balance;
    let total = account.balance;
    children.forEach(child => { total += getGroupBalance(child); });
    return total;
  };

  const isGroupAccount = (account) => {
    return (childMap[account._id] || []).length > 0;
  };

  const toggleType = (key) => {
    setSelectedType(prev => prev === key ? null : key);
    setExpandedTypes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCode = (code) => {
    setExpandedCodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCodes({});
      setExpandedTypes({ asset: false, equity_liability: false, income: false, expense: false });
    } else {
      const newExpanded = {};
      accounts.forEach(a => { if (a.code) newExpanded[a.code] = true; });
      setExpandedCodes(newExpanded);
      setExpandedTypes({ asset: true, equity_liability: true, income: true, expense: true });
    }
    setAllExpanded(!allExpanded);
  };

  const getRootAccounts = (typeKey) => {
    const config = TYPE_CONFIG.find(t => t.key === typeKey);
    if (!config) return [];
    return accounts.filter(a => config.types.includes(a.type) && !a.parent);
  };

  const formatBalance = (balance, type) => {
    const absBal = Math.abs(balance);
    const formatted = formatCurrency(absBal);
    const isDr = ['asset', 'expense'].includes(type);
    if (balance === 0) return `${formatted} Dr.`;
    if (balance > 0) return `${formatted} ${isDr ? 'Dr.' : 'Cr.'}`;
    return `${formatted} ${isDr ? 'Cr.' : 'Dr.'}`;
  };

  const summary = useMemo(() => {
    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, totalIncome = 0, totalExpenses = 0;
    accounts.forEach(a => {
      const bal = Math.abs(a.balance);
      if (a.type === 'asset') totalAssets += bal;
      else if (a.type === 'liability') totalLiabilities += bal;
      else if (a.type === 'equity') totalEquity += bal;
      else if (a.type === 'income') totalIncome += bal;
      else if (a.type === 'expense') totalExpenses += bal;
    });
    return { totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpenses };
  }, [accounts]);

  const filteredAccounts = searchQuery
    ? accounts.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.code?.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const handleSave = async () => {
    if (!form.name) { toast.error('Account name is required'); return; }
    try {
      if (editingAccount) {
        await chartOfAccountsAPI.update(editingAccount._id, form);
        toast.success('Account updated');
      } else {
        await chartOfAccountsAPI.create(form);
        toast.success('Account created');
      }
      setShowModal(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save account');
    }
  };

  const handleDelete = async (id) => {
    try {
      await chartOfAccountsAPI.delete(id);
      toast.success('Account deleted');
      setShowDeleteConfirm(null);
      setMenuOpen(null);
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setForm({
      name: account.name, type: account.type, category: account.category,
      code: account.code || '', description: account.description || '',
      parent: account.parent || '', balance: account.balance || 0,
    });
    setShowModal(true);
    setMenuOpen(null);
  };

  const resetForm = () => {
    setForm({ name: '', type: 'asset', category: 'current_asset', code: '', description: '', parent: '', balance: 0 });
  };

  const handleSidebarClick = (code) => {
    setHighlightCode(code);
    const acc = codeToAccount[code];
    if (acc) {
      setExpandedCodes(prev => ({ ...prev, [code]: true }));
      const config = TYPE_CONFIG.find(tc => tc.types.includes(acc.type));
      if (config) {
        setSelectedType(config.key);
        setExpandedTypes(prev => ({ ...prev, [config.key]: true }));
      }
      setTimeout(() => {
        const el = document.getElementById(`account-row-${acc._id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    setTimeout(() => setHighlightCode(null), 3000);
  };

  const renderAccountRow = (account, depth = 0) => {
    const children = getChildAccounts(account._id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedCodes[account.code] !== false;
    const groupTotal = hasChildren ? getGroupBalance(account) : account.balance;
    const isHighlighted = highlightCode === account.code;
    const typeConfig = TYPE_CONFIG.find(tc => tc.types.includes(account.type));

    return (
      <React.Fragment key={account._id}>
        <tr
          id={`account-row-${account._id}`}
          className={`border-t border-slate-100 transition-colors group ${isHighlighted ? 'bg-blue-50' : 'hover:bg-slate-50/50'} ${hasChildren ? 'bg-slate-50/30' : ''}`}
        >
          <td className="py-2.5" style={{ paddingLeft: `${24 + depth * 24}px` }}>
            <div className="flex items-center gap-1.5">
              {hasChildren ? (
                <button onClick={() => toggleCode(account.code)} className="p-0.5 rounded hover:bg-slate-200 transition-colors">
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  }
                </button>
              ) : <span className="w-5" />}
              {account.isDefault && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
              <span className={`text-sm ${hasChildren ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                {account.name}
              </span>
            </div>
          </td>
          <td className="px-4 py-2.5">
            <span className="text-xs font-mono text-slate-500">{account.code || '-'}</span>
          </td>
          <td className="px-4 py-2.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig?.bg || 'bg-slate-50'} ${typeConfig?.text || 'text-slate-700'}`}>
              {CATEGORY_LABELS[account.category] || account.type}
            </span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className={`text-sm font-semibold ${groupTotal >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {formatBalance(groupTotal, account.type)}
            </span>
          </td>
          <td className="px-3 py-2.5 w-10">
            <div className="relative">
              <button onClick={() => setMenuOpen(menuOpen === account._id ? null : account._id)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
              ><MoreVertical className="w-4 h-4" /></button>
              {menuOpen === account._id && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[160px]">
                  <button onClick={() => { navigate(`/accounting/account-statements?account=${account._id}`); setMenuOpen(null); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                  ><Eye className="w-3.5 h-3.5" /> View Statement</button>
                  {!account.isDefault && (
                    <>
                      <button onClick={() => handleEdit(account)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(account); setMenuOpen(null); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && children
          .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
          .map(child => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const renderSearchResults = () => {
    if (!filteredAccounts) return null;
    const results = filteredAccounts.filter(a => !isGroupAccount(a));
    if (results.length === 0) {
      return (
        <tr>
          <td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-500">
            No accounts found matching "{searchQuery}"
          </td>
        </tr>
      );
    }
    return results.map(account => {
      const typeConfig = TYPE_CONFIG.find(tc => tc.types.includes(account.type));
      return (
        <tr key={account._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors group">
          <td className="py-2.5" style={{ paddingLeft: '24px' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-5" />
              {account.isDefault && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
              <span className="text-sm text-slate-700">{account.name}</span>
            </div>
          </td>
          <td className="px-4 py-2.5">
            <span className="text-xs font-mono text-slate-500">{account.code || '-'}</span>
          </td>
          <td className="px-4 py-2.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig?.bg || 'bg-slate-50'} ${typeConfig?.text || 'text-slate-700'}`}>
              {CATEGORY_LABELS[account.category] || account.type}
            </span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className={`text-sm font-semibold ${account.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {formatBalance(account.balance, account.type)}
            </span>
          </td>
          <td className="px-3 py-2.5 w-10">
            <div className="relative">
              <button onClick={() => setMenuOpen(menuOpen === account._id ? null : account._id)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
              ><MoreVertical className="w-4 h-4" /></button>
              {menuOpen === account._id && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[160px]">
                  <button onClick={() => { navigate(`/accounting/account-statements?account=${account._id}`); setMenuOpen(null); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                  ><Eye className="w-3.5 h-3.5" /> View Statement</button>
                  {!account.isDefault && (
                    <>
                      <button onClick={() => handleEdit(account)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(account); setMenuOpen(null); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ACCOUNT TYPE</h3>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedType(null)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!selectedType ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span>All Accounts</span>
              <span className="ml-auto text-xs text-slate-400">{accounts.length}</span>
            </button>
            {TYPE_CONFIG.map(tc => {
              return (<div key={tc.key}>
                <button
                  onClick={() => toggleType(tc.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedType === tc.key ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>{tc.label}</span>
                  <span className="text-xs text-slate-400">{accounts.filter(a => tc.types.includes(a.type) && !a.parent).length}</span>
                  {expandedTypes[tc.key]
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                </button>
                <AnimatePresence>
                  {expandedTypes[tc.key] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-3 py-0.5 space-y-0.5">
                        {(SIDEBAR_TREE[tc.key] || []).map(item => (
                          <SidebarItem
                            key={item.code}
                            item={item}
                            depth={0}
                            expandedCodes={expandedCodes}
                            toggleCode={toggleCode}
                            handleSidebarClick={handleSidebarClick}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>);
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {TYPE_CONFIG.map(tc => {
              let total = 0;
              if (tc.key === 'asset') total = summary.totalAssets;
              else if (tc.key === 'equity_liability') total = summary.totalLiabilities + summary.totalEquity;
              else if (tc.key === 'income') total = summary.totalIncome;
              else if (tc.key === 'expense') total = summary.totalExpenses;
              return (
                <div key={tc.key} className={`rounded-xl border p-3 ${tc.border} ${tc.bg}`}>
                  <div className={`text-xs font-semibold ${tc.text} mb-1`}>{tc.label}</div>
                  <div className={`text-lg font-bold ${tc.text}`}>{formatCurrency(total)}</div>
                </div>
              );
            })}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Chart of Accounts</h1>
              <Info className="w-4 h-4 text-slate-400" />
            </div>
            <button onClick={() => { resetForm(); setEditingAccount(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E11D48] text-white text-sm font-semibold rounded-full hover:bg-[#BE123C] transition-all shadow-lg"
            ><Plus className="w-4 h-4" /> New Account</button>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {selectedType && (
                <button onClick={() => setSelectedType(null)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                  <X className="w-3 h-3" /> {TYPE_CONFIG.find(tc => tc.key === selectedType)?.label}
                </button>
              )}
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                {allExpanded ? 'Collapse All' : 'Expand All'}
                {allExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Accounts"
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Account Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3.5 text-left text-2xs font-semibold text-slate-500 uppercase tracking-widest">ACCOUNT NAME</th>
                    <th className="px-4 py-3.5 text-left text-2xs font-semibold text-slate-500 uppercase tracking-widest">CODE</th>
                    <th className="px-4 py-3.5 text-left text-2xs font-semibold text-slate-500 uppercase tracking-widest">TYPE</th>
                    <th className="px-4 py-3.5 text-right text-2xs font-semibold text-slate-500 uppercase tracking-widest">BALANCE</th>
                    <th className="px-3 py-3.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {searchQuery ? renderSearchResults() : TYPE_CONFIG
                    .filter(tc => !selectedType || tc.key === selectedType)
                    .map(tc => {
                      const roots = getRootAccounts(tc.key);
                      if (roots.length === 0) return null;
                      return (
                        <React.Fragment key={tc.key}>
                          {roots.sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(root => renderAccountRow(root, 0))}
                        </React.Fragment>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg overflow-hidden border"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-slate-900">{editingAccount ? 'Edit Account' : 'New Account'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Enter account name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Type *</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: CHART_CATEGORIES[e.target.value]?.[0]?.value || 'current_asset' })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                      <option value="equity">Equity</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {(CHART_CATEGORIES[form.type] || []).map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Parent Account</label>
                  <select value={form.parent} onChange={e => setForm({ ...form, parent: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">None (Top Level)</option>
                    {accounts.filter(a => a._id !== editingAccount?._id).map(a => (
                      <option key={a._id} value={a._id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Code</label>
                    <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Opening Balance</label>
                    <input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    rows={2} placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-slate-50/50">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={handleSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E11D48] text-white text-sm font-semibold rounded-full hover:bg-[#BE123C] shadow-sm"
                ><Save className="w-4 h-4" /> {editingAccount ? 'Update' : 'Save'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white rounded-2xl shadow-elevated w-full max-w-sm overflow-hidden border p-6"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Account</h3>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? This action cannot be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Cancel</button>
                <button onClick={() => handleDelete(showDeleteConfirm._id)}
                  className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700"
                >Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SidebarItem = ({ item, depth, expandedCodes, toggleCode, handleSidebarClick }) => {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedCodes[item.code] !== false;

  return (
    <div>
      <button
        onClick={() => {
          handleSidebarClick(item.code);
          if (hasChildren) toggleCode(item.code);
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        <span>{item.label}</span>
        {hasChildren && (
          isExpanded
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />
        )}
      </button>
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {item.children.map(child => (
            <SidebarItem
              key={child.code}
              item={child}
              depth={depth + 1}
              expandedCodes={expandedCodes}
              toggleCode={toggleCode}
              handleSidebarClick={handleSidebarClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
