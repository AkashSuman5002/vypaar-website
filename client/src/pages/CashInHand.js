import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../components/CashBank/EmptyState';
import ModalDialog from '../components/CashBank/ModalDialog';
import FormField from '../components/CashBank/FormField';
import { transactionAPI } from '../services/api';
import { toast } from 'react-toastify';

const CashInHand = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'add',
    amount: '',
    updatedCash: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [txnRes, balRes] = await Promise.all([
        transactionAPI.getAll(),
        transactionAPI.getBalance(),
      ]);
      const cashTxns = (txnRes.data || []).filter(t => t.type === 'cash_in' || t.type === 'cash_out');
      setAdjustments(cashTxns.map(t => ({
        id: t._id,
        type: t.type === 'cash_in' ? 'add' : 'reduce',
        amount: String(t.amount),
        date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
        description: t.description || '',
      })));
      setBalance(balRes.data.cashBalance || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const currentBalance = balance;

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'type') {
        updated.amount = '';
        updated.updatedCash = '';
      }
      if (field === 'amount' && updated.amount) {
        const amt = parseFloat(updated.amount) || 0;
        updated.updatedCash = updated.type === 'add' ? amt : -amt;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.amount) return;
    try {
      const backendType = form.type === 'add' ? 'cash_in' : 'cash_out';
      await transactionAPI.create({
        type: backendType,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date || new Date(),
      });
      toast.success('Cash adjustment saved');
      setModalOpen(false);
      setForm({
        type: 'add', amount: '', updatedCash: '',
        date: new Date().toISOString().split('T')[0], description: '',
      });
      await loadData();
    } catch {
      toast.error('Failed to save');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 p-6">
      {adjustments.length === 0 ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Cash In Hand</h1>
              <span className="text-lg font-semibold" style={{ color: '#22C55E' }}>₹0</span>
            </div>
          </div>
          <EmptyState
            icon={
              <svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="25" y="15" width="50" height="60" rx="6" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
                <rect x="30" y="22" width="40" height="6" rx="3" fill="#D1D5DB" />
                <rect x="30" y="32" width="25" height="3" rx="1.5" fill="#E5E7EB" />
                <rect x="30" y="38" width="35" height="3" rx="1.5" fill="#E5E7EB" />
                <rect x="30" y="44" width="20" height="3" rx="1.5" fill="#E5E7EB" />
                <rect x="38" y="52" width="24" height="14" rx="3" fill="#D1D5DB" />
                <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#9CA3AF" fontWeight="bold">₹</text>
              </svg>
            }
            subtitle="Whenever you choose payment type as cash in your invoices, that amount will be reflected in cash in hand."
          >
            <button
              onClick={() => setModalOpen(true)}
              className="px-5 py-2.5 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
              style={{ backgroundColor: '#FF2D55' }}
            >
              Adjust Cash
            </button>
          </EmptyState>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Cash In Hand</h1>
              <span className="text-lg font-semibold" style={{ color: '#22C55E' }}>₹{currentBalance.toLocaleString()}</span>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
              style={{ backgroundColor: '#FF2D55' }}
            >
              Adjust Cash
            </button>
          </div>
          <div className="space-y-2">
            {adjustments.map((a) => (
              <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.description || 'Cash adjustment'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
                </div>
                <span className={`text-sm font-semibold ${a.type === 'add' ? 'text-green-600' : 'text-red-500'}`}>
                  {a.type === 'add' ? '+' : '-'}₹{parseFloat(a.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <ModalDialog open={modalOpen} onClose={() => setModalOpen(false)} title="Adjust Cash" width="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.type === 'add' ? 'border-red-500' : 'border-gray-300'}`}
                onClick={() => setForm({ ...form, type: 'add', amount: '', updatedCash: '' })}
              >
                {form.type === 'add' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF2D55' }} />}
              </div>
              <span className="text-sm text-gray-700">Add Cash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.type === 'reduce' ? 'border-red-500' : 'border-gray-300'}`}
                onClick={() => setForm({ ...form, type: 'reduce', amount: '', updatedCash: '' })}
              >
                {form.type === 'reduce' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF2D55' }} />}
              </div>
              <span className="text-sm text-gray-700">Reduce Cash</span>
            </label>
          </div>

          <FormField label="Enter Amount" required>
            <input
              type="number"
              value={form.amount}
              onChange={handleChange('amount')}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </FormField>

          <FormField label="Updated Cash">
            <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500 bg-gray-50">
              {form.type === 'add' ? '+' : '-'}₹{parseFloat(form.updatedCash || 0).toLocaleString()}
            </div>
          </FormField>

          <FormField label="Adjustment Date">
            <input
              type="date"
              value={form.date}
              onChange={handleChange('date')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Enter description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors shadow-sm"
              style={{ backgroundColor: '#FF2D55' }}
            >
              Save
            </button>
          </div>
        </div>
      </ModalDialog>
    </motion.div>
  );
};

export default CashInHand;
