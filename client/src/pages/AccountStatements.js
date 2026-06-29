import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { chartOfAccountsAPI } from '../services/api';
import {
  Search, ChevronLeft, ChevronRight, Loader2, FileText, Download, Filter,
} from 'lucide-react';

const AccountStatements = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('account');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    chartOfAccountsAPI.getAll()
      .then(({ data }) => {
        setAccounts(data);
        if (preselectedId) {
          const acc = data.find(a => a._id === preselectedId);
          if (acc) setSelectedAccount(acc);
        }
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load accounts'); setLoading(false); });
  }, []);

  const fetchStatement = async (accountId, page = 1) => {
    if (!accountId) return;
    setStatementLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await chartOfAccountsAPI.getStatement(accountId, params);
      setStatement(data);
      setTotalPages(data.pages);
      setCurrentPage(data.page);
    } catch (err) {
      toast.error('Failed to load account statement');
    } finally {
      setStatementLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) fetchStatement(selectedAccount._id, currentPage);
  }, [selectedAccount, currentPage, startDate, endDate]);

  const filteredAccounts = searchQuery
    ? accounts.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.code?.toLowerCase().includes(searchQuery.toLowerCase()))
    : accounts;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Account Statements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">View detailed account transaction statements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Select Account</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
            {filteredAccounts.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No accounts found</div>
            ) : (
              filteredAccounts.map(account => (
                <button
                  key={account._id}
                  onClick={() => { setSelectedAccount(account); setCurrentPage(1); }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-50 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedAccount?._id === account._id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{account.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{account.code} · {account.type}</p>
                  </div>
                  <span className={`text-sm font-semibold ${account.balance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(account.balance))}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Statement View */}
        <div className="lg:col-span-2">
          {!selectedAccount ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft p-12 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Select an Account</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose an account from the list to view its statement</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{selectedAccount.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedAccount.code} · {selectedAccount.type} · Balance: {formatCurrency(selectedAccount.balance)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {statementLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
              ) : !statement || statement.entries.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">No transactions found for this account</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-gray-700">
                          <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Entry No</th>
                          <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Narration</th>
                          <th className="px-4 py-3 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Debit</th>
                          <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Credit</th>
                          <th className="px-4 py-3 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.entries.map((entry, idx) => (
                          <tr key={entry._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(entry.entryDate)}</td>
                            <td className="px-4 py-3"><span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{entry.entryNumber}</span></td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{entry.narration}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex px-2 py-0.5 text-2xs font-medium rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-400">
                                {entry.referenceType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-gray-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{statement.total} transactions</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60 disabled:opacity-30 text-slate-500 dark:text-slate-400"
                      ><ChevronLeft className="w-4 h-4" /></button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700/60'}`}
                        >{p}</button>
                      ))}
                      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/60 disabled:opacity-30 text-slate-500 dark:text-slate-400"
                      ><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AccountStatements;
