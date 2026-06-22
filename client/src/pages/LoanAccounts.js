import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { LayoutDashboard, RefreshCw, Sliders, Pencil, Trash2, Landmark } from 'lucide-react';
import EmptyState from '../components/UI/EmptyState';
import FeatureCard from '../components/CashBank/FeatureCard';
import Modal from '../components/UI/Modal';
import FormField from '../components/CashBank/FormField';
import { loanAccountAPI } from '../services/api';

// Shared dark-mode-safe field styles.
const INP = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

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
        interestRate: a.metadata?.interestRate || '', termDuration: a.metadata?.termDuration || '',
      })) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.accountName || !form.currentBalance) {
      toast.error('Account name and current balance are required');
      return;
    }
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
        // Also nest under metadata so the generic update path persists these too.
        metadata: {
          accountNumber: form.accountNumber, lenderBank: form.lenderBank,
          interestRate: form.interestRate, processingFee: form.processingFee,
          termDuration: form.termDuration,
        },
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
      interestRate: loan.interestRate || '',
      processingFee: '',
      lenderBank: loan.lenderBank || '',
      description: '',
      balanceAsOf: new Date().toISOString().split('T')[0],
      termDuration: loan.termDuration || '',
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

  const addBtn = (
    <button
      onClick={() => { setEditing(null); setModalOpen(true); }}
      className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm bg-rose-500 hover:bg-rose-600"
    >
      + Add Loan Account
    </button>
  );

  if (!loading && loans.length === 0 && !modalOpen) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <EmptyState
          icon={
            <div className="w-20 h-20 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
              <Landmark className="w-9 h-9 text-rose-500" />
            </div>
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
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm bg-rose-500 hover:bg-rose-600"
          >
            + Add Loan Account
          </button>
        </EmptyState>
        {renderModal()}
      </motion.div>
    );
  }

  function renderModal() {
    return (
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Loan Account' : 'Add Loan Account'} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <FormField label="Account Name" required>
              <input type="text" value={form.accountName} onChange={handleChange('accountName')} placeholder="Enter account name" className={INP} />
            </FormField>
            <FormField label="Account Number">
              <input type="text" value={form.accountNumber} onChange={handleChange('accountNumber')} placeholder="Enter account number" className={INP} />
            </FormField>
            <FormField label="Current Balance" required>
              <input type="number" value={form.currentBalance} onChange={handleChange('currentBalance')} placeholder="0" className={INP} />
            </FormField>
            <FormField label="Loan received In">
              <select value={form.loanReceivedIn} onChange={handleChange('loanReceivedIn')} className={INP}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
              </select>
            </FormField>
            <FormField label="Interest Rate (%)">
              <input type="number" value={form.interestRate} onChange={handleChange('interestRate')} placeholder="0" className={INP} />
            </FormField>
            <FormField label="Processing Fee">
              <input type="number" value={form.processingFee} onChange={handleChange('processingFee')} placeholder="0" className={INP} />
            </FormField>
          </div>
          <div className="space-y-4">
            <FormField label="Lender Bank">
              <input type="text" value={form.lenderBank} onChange={handleChange('lenderBank')} placeholder="Enter lender bank name" className={INP} />
            </FormField>
            <FormField label="Description">
              <textarea value={form.description} onChange={handleChange('description')} placeholder="Enter description" rows={2} className={INP + ' resize-none'} />
            </FormField>
            <FormField label="Balance as of">
              <input type="date" value={form.balanceAsOf} onChange={handleChange('balanceAsOf')} className={INP} />
            </FormField>
            <FormField label="Term Duration (in Months)">
              <input type="number" value={form.termDuration} onChange={handleChange('termDuration')} placeholder="0" className={INP} />
            </FormField>
            <FormField label="Processing Fee Paid From">
              <select value={form.processingFeePaidFrom} onChange={handleChange('processingFeePaidFrom')} className={INP}>
                <option value="cash">Cash</option>
                <option value="existing_bank">Existing Bank Accounts</option>
                <option value="add_new_bank">Add New Bank Account</option>
              </select>
            </FormField>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => { setModalOpen(false); setEditing(null); }}
            className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm bg-blue-600 hover:bg-blue-700">
            Save
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loan Accounts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{loans.length} loan account{loans.length !== 1 ? 's' : ''}</p>
          </div>
          {addBtn}
        </div>

        {loans.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            No loan accounts yet. Click “Add Loan Account” to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => (
              <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <Landmark className="w-5 h-5 text-rose-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{loan.accountName}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {loan.lenderBank || 'Loan Account'}
                        {loan.accountNumber ? ` · A/C ${loan.accountNumber}` : ''}
                        {loan.interestRate ? ` · ${loan.interestRate}% p.a.` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Outstanding</p>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">₹{parseFloat(loan.currentBalance || 0).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleEdit(loan)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(loan.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderModal()}
    </motion.div>
  );
};

export default LoanAccounts;
