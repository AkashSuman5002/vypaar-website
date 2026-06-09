import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { LayoutDashboard, RefreshCw, Sliders, Pencil, Trash2 } from 'lucide-react';
import EmptyState from '../components/CashBank/EmptyState';
import FeatureCard from '../components/CashBank/FeatureCard';
import ModalDialog from '../components/CashBank/ModalDialog';
import FormField from '../components/CashBank/FormField';
import { loanAccountAPI } from '../services/api';

const LoanAccounts = () => {
  const [loans, setLoans] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    accountName: '', accountNumber: '', currentBalance: '', loanReceivedIn: 'cash',
    interestRate: '', processingFee: '', lenderBank: '', description: '',
    balanceAsOf: new Date().toISOString().split('T')[0], termDuration: '', processingFeePaidFrom: 'cash',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await loanAccountAPI.getAll();
      setLoans(Array.isArray(res.data) ? res.data.map(a => ({
        id: a._id, accountName: a.name, currentBalance: String(a.balance || 0),
        lenderBank: a.metadata?.lenderBank || '', accountNumber: a.metadata?.accountNumber || '',
      })) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.accountName || !form.currentBalance) return;
    try {
      const payload = {
        name: form.accountName,
        balance: parseFloat(form.currentBalance) || 0,
        accountNumber: form.accountNumber,
        lenderBank: form.lenderBank,
        interestRate: form.interestRate,
        processingFee: form.processingFee,
        description: form.description,
        termDuration: form.termDuration,
      };
      if (editing) {
        await loanAccountAPI.update(editing.id, payload);
        toast.success('Loan account updated');
      } else {
        await loanAccountAPI.create(payload);
        toast.success('Loan account saved');
      }
      setModalOpen(false);
      setEditing(null);
      setForm({
        accountName: '', accountNumber: '', currentBalance: '', loanReceivedIn: 'cash',
        interestRate: '', processingFee: '', lenderBank: '', description: '',
        balanceAsOf: new Date().toISOString().split('T')[0], termDuration: '', processingFeePaidFrom: 'cash',
      });
      await loadData();
    } catch {
      toast.error('Failed to save loan account');
    }
  };

  const handleEdit = (loan) => {
    setEditing(loan);
    setForm({
      accountName: loan.accountName || '',
      accountNumber: loan.accountNumber || '',
      currentBalance: loan.currentBalance || '',
      loanReceivedIn: 'cash',
      interestRate: '',
      processingFee: '',
      lenderBank: loan.lenderBank || '',
      description: '',
      balanceAsOf: new Date().toISOString().split('T')[0],
      termDuration: '',
      processingFeePaidFrom: 'cash',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this loan account?')) return;
    try {
      await loanAccountAPI.delete(id);
      toast.success('Loan account deleted');
      await loadData();
    } catch {
      toast.error('Failed to delete loan account');
    }
  };

  if (!loading && loans.length === 0 && !modalOpen) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
        <EmptyState
          icon={
            <svg width="110" height="90" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="25" width="80" height="55" rx="6" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
              <rect x="22" y="32" width="66" height="8" rx="2" fill="#D1D5DB" />
              <rect x="22" y="44" width="66" height="3" rx="1.5" fill="#E5E7EB" />
              <rect x="22" y="50" width="50" height="3" rx="1.5" fill="#E5E7EB" />
              <rect x="22" y="56" width="35" height="3" rx="1.5" fill="#E5E7EB" />
              <rect x="22" y="65" width="20" height="8" rx="2" fill="#D1D5DB" />
              <rect x="46" y="65" width="20" height="8" rx="2" fill="#D1D5DB" />
              <rect x="70" y="65" width="18" height="8" rx="2" fill="#D1D5DB" />
              <rect x="35" y="10" width="40" height="18" rx="4" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />
              <rect x="42" y="15" width="10" height="8" rx="1" fill="#9CA3AF" />
              <rect x="56" y="15" width="12" height="8" rx="1" fill="#9CA3AF" />
              <rect x="45" y="17" width="4" height="4" rx="1" fill="white" />
            </svg>
          }
          title="Manage Your Loan Accounts"
          subtitle="Add your loan accounts and check all loan transactions at one place"
        >
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <FeatureCard
              icon={LayoutDashboard}
              title="All Loans, One Dashboard"
              description="View and manage all your loan accounts from a single dashboard at a glance."
            />
            <FeatureCard
              icon={RefreshCw}
              title="Auto EMI Calculation with Every Entry"
              description="Automatically calculate EMIs with each transaction entry for accurate tracking."
            />
            <FeatureCard
              icon={Sliders}
              title="Manual Flexibility"
              description="Manually adjust loan entries, EMIs, and payments with full control."
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
            style={{ backgroundColor: '#FF2D55' }}
          >
            + Add Loan Account
          </button>
        </EmptyState>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
      {loans.length > 0 && (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Loan Accounts</h1>
            <button
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="px-4 py-2 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
              style={{ backgroundColor: '#FF2D55' }}
            >
              + Add Loan Account
            </button>
          </div>
          <div className="space-y-3">
            {loans.map((loan) => (
              <div key={loan.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{loan.accountName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{loan.lenderBank || 'Loan Account'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      ₹{parseFloat(loan.currentBalance || 0).toLocaleString()}
                    </span>
                    <button onClick={() => handleEdit(loan)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(loan.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalDialog open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Loan Account' : 'Add Loan Account'} width="max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <FormField label="Account Name" required>
              <input
                type="text"
                value={form.accountName}
                onChange={handleChange('accountName')}
                placeholder="Enter account name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Account Number">
              <input
                type="text"
                value={form.accountNumber}
                onChange={handleChange('accountNumber')}
                placeholder="Enter account number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Current Balance" required>
              <input
                type="number"
                value={form.currentBalance}
                onChange={handleChange('currentBalance')}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Loan received In">
              <select
                value={form.loanReceivedIn}
                onChange={handleChange('loanReceivedIn')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
              </select>
            </FormField>
            <FormField label="Interest Rate (%)">
              <input
                type="number"
                value={form.interestRate}
                onChange={handleChange('interestRate')}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Processing Fee">
              <input
                type="number"
                value={form.processingFee}
                onChange={handleChange('processingFee')}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
          </div>
          <div className="space-y-4">
            <FormField label="Lender Bank">
              <input
                type="text"
                value={form.lenderBank}
                onChange={handleChange('lenderBank')}
                placeholder="Enter lender bank name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Description">
              <textarea
                value={form.description}
                onChange={handleChange('description')}
                placeholder="Enter description"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </FormField>
            <FormField label="Balance as of">
              <input
                type="date"
                value={form.balanceAsOf}
                onChange={handleChange('balanceAsOf')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Term Duration (in Months)">
              <input
                type="number"
                value={form.termDuration}
                onChange={handleChange('termDuration')}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </FormField>
            <FormField label="Processing Fee Paid From">
              <select
                value={form.processingFeePaidFrom}
                onChange={handleChange('processingFeePaidFrom')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="existing_bank">Existing Bank Accounts</option>
                <option value="add_new_bank">Add New Bank Account</option>
              </select>
            </FormField>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setModalOpen(false)}
            className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white rounded-md transition-colors shadow-sm"
            style={{ backgroundColor: '#2563EB' }}
          >
            Save
          </button>
        </div>
      </ModalDialog>
    </motion.div>
  );
};

export default LoanAccounts;