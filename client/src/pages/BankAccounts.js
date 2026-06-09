import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Check, Printer, Landmark, CreditCard, Pencil, Trash2 } from 'lucide-react';
import EmptyState from '../components/CashBank/EmptyState';
import FeatureCard from '../components/CashBank/FeatureCard';
import FormField from '../components/CashBank/FormField';
import { bankAccountAPI, transactionAPI } from '../services/api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../utils/format';

const BankAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    displayName: '',
    openingBalance: '',
    asOfDate: new Date().toISOString().split('T')[0],
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    bankName: '',
    accountHolderName: '',
    printQr: false,
    printDetails: false,
    acceptPayments: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await bankAccountAPI.getAll();
      setAccounts(res.data.map(a => ({
        id: a._id,
        displayName: a.name,
        openingBalance: String(a.balance || 0),
        bankName: a.metadata?.bankName || '',
        accountNumber: a.metadata?.accountNumber || '',
        ifscCode: a.metadata?.ifscCode || '',
        upiId: a.metadata?.upiId || '',
        accountHolderName: a.metadata?.accountHolderName || '',
        printQr: a.metadata?.printQr || false,
        printDetails: a.metadata?.printDetails || false,
        acceptPayments: a.metadata?.acceptPayments || false,
      })));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: val });
  };

  const handleSave = async () => {
    if (!form.displayName && !form.bankName) return;
    try {
      const payload = {
        name: form.displayName || form.bankName,
        openingBalance: parseFloat(form.openingBalance) || 0,
        metadata: {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          upiId: form.upiId,
          accountHolderName: form.accountHolderName,
          printQr: form.printQr,
          printDetails: form.printDetails,
          acceptPayments: form.acceptPayments,
        },
      };
      if (editing) {
        await bankAccountAPI.update(editing.id, payload);
        toast.success('Bank account updated');
      } else {
        await bankAccountAPI.create(payload);
        toast.success('Bank account saved');
      }
      setShowForm(false);
      setExpanded(false);
      setEditing(null);
      setForm({
        displayName: '', openingBalance: '', asOfDate: new Date().toISOString().split('T')[0],
        accountNumber: '', ifscCode: '', upiId: '', bankName: '', accountHolderName: '',
        printQr: false, printDetails: false, acceptPayments: false,
      });
      await loadData();
    } catch {
      toast.error('Failed to save bank account');
    }
  };

  const handleEdit = (acc) => {
    setEditing(acc);
    setForm({
      displayName: acc.displayName || '',
      openingBalance: acc.openingBalance || '',
      asOfDate: new Date().toISOString().split('T')[0],
      accountNumber: acc.accountNumber || '',
      ifscCode: acc.ifscCode || '',
      upiId: acc.upiId || '',
      bankName: acc.bankName || '',
      accountHolderName: acc.accountHolderName || '',
      printQr: acc.printQr || false,
      printDetails: acc.printDetails || false,
      acceptPayments: acc.acceptPayments || false,
    });
    setShowForm(true);
    setExpanded(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bank account?')) return;
    try {
      await bankAccountAPI.delete(id);
      toast.success('Bank account deleted');
      await loadData();
    } catch {
      toast.error('Failed to delete bank account');
    }
  };

  if (accounts.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
        <EmptyState
          icon={
            <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="25" width="100" height="65" rx="6" fill="#E5E7EB" />
              <rect x="15" y="30" width="90" height="12" rx="2" fill="#D1D5DB" />
              <rect x="15" y="46" width="90" height="3" rx="1.5" fill="#D1D5DB" />
              <rect x="15" y="53" width="60" height="3" rx="1.5" fill="#E5E7EB" />
              <rect x="15" y="60" width="40" height="3" rx="1.5" fill="#E5E7EB" />
              <circle cx="60" cy="20" r="15" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" />
              <rect x="54" y="16" width="12" height="8" rx="1" fill="#9CA3AF" />
              <circle cx="60" cy="20" r="6" fill="#9CA3AF" />
              <rect x="20" y="72" width="12" height="8" rx="1" fill="#D1D5DB" />
              <rect x="36" y="72" width="12" height="8" rx="1" fill="#D1D5DB" />
              <rect x="68" y="72" width="12" height="8" rx="1" fill="#D1D5DB" />
            </svg>
          }
          title="Manage Multiple Bank Accounts"
          subtitle="With Vyapar you can manage multiple banks and payment types like UPI, Net Banking and Credit Card"
        >
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <FeatureCard
              icon={Printer}
              title="Print Bank Details on Invoices"
              description="Print account details on invoices and get payments via NEFT/RTGS/IMPS."
            />
            <FeatureCard
              icon={Landmark}
              title="Unlimited Payment Types"
              description="Record transactions by methods like Banks, UPI, Net Banking and Cards."
            />
            <FeatureCard
              icon={CreditCard}
              title="Print UPI QR Code on Invoices"
              description="Print QR code on your invoices or send payment links to your customers."
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
          >
            + Add Bank Account
          </button>
        </EmptyState>
      </motion.div>
    );
  }

  if (showForm) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">{editing ? 'Edit Bank Account' : 'Add Bank Account'}</h1>
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Account Display Name" required>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={handleChange('displayName')}
                  placeholder="Enter account display name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </FormField>
              <FormField label="Opening Balance">
                <input
                  type="number"
                  value={form.openingBalance}
                  onChange={handleChange('openingBalance')}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </FormField>
              <FormField label="As of Date">
                <input
                  type="date"
                  value={form.asOfDate}
                  onChange={handleChange('asOfDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </FormField>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              + Add more fields
            </button>

            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Account Number">
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={handleChange('accountNumber')}
                      placeholder="Enter account number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormField>
                  <FormField label="IFSC Code">
                    <input
                      type="text"
                      value={form.ifscCode}
                      onChange={handleChange('ifscCode')}
                      placeholder="Enter IFSC code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormField>
                  <FormField label="UPI ID for QR Code">
                    <input
                      type="text"
                      value={form.upiId}
                      onChange={handleChange('upiId')}
                      placeholder="Enter UPI ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormField>
                  <FormField label="Bank Name">
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={handleChange('bankName')}
                      placeholder="Enter bank name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormField>
                  <FormField label="Account Holder Name">
                    <input
                      type="text"
                      value={form.accountHolderName}
                      onChange={handleChange('accountHolderName')}
                      placeholder="Enter account holder name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormField>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.printQr ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                      onClick={() => setForm({ ...form, printQr: !form.printQr })}
                    >
                      {form.printQr && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-gray-700">Print offline UPI QR on Invoices</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.printDetails ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                      onClick={() => setForm({ ...form, printDetails: !form.printDetails })}
                    >
                      {form.printDetails && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-gray-700">Print Bank Details on Invoices</span>
                  </label>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.acceptPayments ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                      onClick={() => setForm({ ...form, acceptPayments: !form.acceptPayments })}
                    >
                      {form.acceptPayments && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 font-medium">Accept Payments Online</span>
                        <span className="text-[10px] font-semibold text-white bg-green-600 px-1.5 py-0.5 rounded">NEW</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Sell across India and accept payments from your customers directly to your bank account via payment gateway.</p>
                    </div>
                  </label>
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={() => { setShowForm(false); setExpanded(false); }}
              className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-semibold bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors shadow-sm"
            >
              Save Details
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Bank Accounts</h1>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
          >
            + Add Bank Account
          </button>
        </div>
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{acc.displayName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{acc.bankName || 'Bank Account'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(acc.openingBalance || 0)}</span>
                  <button onClick={() => handleEdit(acc)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(acc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default BankAccounts;
