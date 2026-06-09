import React, { useState, useEffect } from 'react';
import { purchaseAPI, productAPI, supplierAPI } from '../services/api';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import { toast } from 'react-toastify';
import { formatCurrency, formatDate } from '../utils/format';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, ClipboardList, IndianRupee, Package, DollarSign } from 'lucide-react';

const emptyItem = { productName: '', quantity: '', rate: '', amount: '', gstRate: '0' };

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({
    supplierName: '', supplier: '', billNumber: '', date: new Date().toISOString().split('T')[0],
    items: [{ ...emptyItem }], totalAmount: '', paidAmount: '', paymentStatus: 'unpaid',
    paymentMethod: 'cash', notes: '', isInterState: false,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [pRes, prodRes, supRes] = await Promise.all([
          purchaseAPI.getAll({ page, limit: 20 }),
          productAPI.getAll(),
          supplierAPI.getAll(),
        ]);
        setPurchases(pRes.data.purchases || []);
        setTotal(pRes.data.total || 0);
        setPages(pRes.data.pages || 1);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.products || []);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : supRes.data.suppliers || []);
      } catch { toast.error('Failed to load purchases'); }
      finally { setLoading(false); }
    };
    init();
  }, [page]);

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i][field] = value;
    if (field === 'quantity' || field === 'rate') {
      items[i].amount = (parseFloat(items[i].quantity) || 0) * (parseFloat(items[i].rate) || 0);
    }
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const items = form.items.map((item) => ({
      productName: item.productName || '',
      quantity: parseInt(item.quantity) || 1,
      rate: parseFloat(item.rate) || 0,
      amount: parseFloat(item.amount) || 0,
      gstRate: parseInt(item.gstRate) || 0,
    }));
    const totalAmount = parseFloat(form.totalAmount) || items.reduce((s, i) => s + i.amount, 0);
    const paidAmount = parseFloat(form.paidAmount) || 0;
    const payload = {
      supplier: form.supplier || undefined,
      supplierName: form.supplierName,
      billNumber: form.billNumber,
      date: form.date,
      items,
      totalAmount,
      paidAmount,
      paymentStatus: form.paymentStatus || (paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'),
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      isInterState: form.isInterState,
    };
    try {
      if (edit) {
        await purchaseAPI.update(edit._id, payload);
        toast.success('Purchase updated');
      } else {
        await purchaseAPI.create(payload);
        toast.success('Purchase created');
      }
      setModal(false); setEdit(null);
      setForm({ supplierName: '', supplier: '', billNumber: '', date: new Date().toISOString().split('T')[0], items: [{ ...emptyItem }], totalAmount: '', paidAmount: '', paymentStatus: 'unpaid', paymentMethod: 'cash', notes: '', isInterState: false });
      const { data } = await purchaseAPI.getAll({ page, limit: 20 });
      setPurchases(data.purchases || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase?')) return;
    try {
      await purchaseAPI.delete(id);
      toast.success('Purchase deleted');
      const { data } = await purchaseAPI.getAll({ page, limit: 20 });
      setPurchases(data.purchases || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { toast.error('Delete failed'); }
  };

  const totalPurchasesAmount = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalItems = purchases.reduce((s, p) => s + (p.items || []).reduce((a, i) => a + (i.quantity || 0), 0), 0);
  const pendingDues = purchases.reduce((s, p) => s + (p.remainingBalance || 0), 0);

  const columns = [
    { key: 'supplierName', label: 'Supplier', render: (v) => <span className="font-medium text-slate-900 dark:text-slate-100">{v}</span> },
    { key: 'billNumber', label: 'Bill No' },
    { key: 'items', label: 'Items', render: (v) => (v || []).map((i) => i.productName).join(', ') },
    { key: 'totalAmount', label: 'Amount', render: (v) => <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(v)}</span> },
    { key: 'remainingBalance', label: 'Due', render: (v) => <span className={`font-semibold ${v > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(v)}</span> },
    { key: 'date', label: 'Date', render: (v) => <span className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(v)}</span> },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-0.5">
          <button onClick={() => { setEdit(row); setForm({
            supplierName: row.supplierName, supplier: row.supplier || '', billNumber: row.billNumber || '',
            date: row.date?.split('T')[0] || '', items: row.items?.length ? row.items.map(i => ({
              productName: i.productName || '',
              quantity: String(i.quantity || ''),
              rate: String(i.rate || ''),
              amount: String(i.amount || ''),
              gstRate: String(i.gstRate || '0'),
            })) : [{ ...emptyItem }],
            totalAmount: String(row.totalAmount || ''), paidAmount: String(row.paidAmount || ''),
            paymentStatus: row.paymentStatus || 'unpaid', paymentMethod: row.paymentMethod || 'cash',
            notes: row.notes || '', isInterState: row.isInterState || false,
          }); setModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(row._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchases</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track inventory purchases</p>
        </div>
        <button onClick={() => { setEdit(null); setForm({ supplierName: '', supplier: '', billNumber: '', date: new Date().toISOString().split('T')[0], items: [{ ...emptyItem }], totalAmount: '', paidAmount: '', paymentStatus: 'unpaid', paymentMethod: 'cash', notes: '', isInterState: false }); setModal(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Purchases</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(totalPurchasesAmount)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"><Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Items</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalItems}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl"><DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Dues</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(pendingDues)}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl"><IndianRupee className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>
            <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg per Purchase</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(purchases.length ? totalPurchasesAmount / purchases.length : 0)}</p></div>
          </div>
        </div>
      </div>

      {purchases.length === 0 ? (
        <EmptyState type="purchases" actionLabel="Add Purchase" onAction={() => { setEdit(null); setForm({ supplierName: '', supplier: '', billNumber: '', date: new Date().toISOString().split('T')[0], items: [{ ...emptyItem }], totalAmount: '', paidAmount: '', paymentStatus: 'unpaid', paymentMethod: 'cash', notes: '', isInterState: false }); setModal(true); }} />
      ) : (
        <>
          <DataTable columns={columns} data={purchases} />
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {page} of {pages} ({total} total)</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">Prev</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Edit Purchase' : 'Add Purchase'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Supplier</label>
              <select value={form.supplier} onChange={(e) => { const sup = suppliers.find((s) => s._id === e.target.value); setForm({ ...form, supplier: e.target.value, supplierName: sup ? sup.name : form.supplierName }); }} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                <option value="">Select</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Supplier Name</label>
              <input placeholder="Supplier name" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Bill Number</label>
              <input placeholder="INV-001" value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
          </div>

          <div className="border border-slate-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Line Items</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Add Item</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <input placeholder="Product name" value={item.productName} onChange={(e) => updateItem(i, 'productName', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <input placeholder="Qty" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-16 px-2 py-1.5 border border-slate-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-slate-900 dark:text-slate-100" />
                <input placeholder="Rate" type="number" step="0.01" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-slate-900 dark:text-slate-100" />
                <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right">{formatCurrency(item.amount || 0)}</span>
                {form.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Total Amount (₹)</label>
              <input placeholder="Auto" type="number" step="0.01" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Paid Amount (₹)</label>
              <input placeholder="0" type="number" step="0.01" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Status</label>
              <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm">
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Method</label>
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
            <textarea placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm" />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={form.isInterState} onChange={(e) => setForm({ ...form, isInterState: e.target.checked })} className="rounded border-slate-300 dark:border-gray-600" />
            Inter-State Purchase (IGST)
          </label>

          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">{edit ? 'Update Purchase' : 'Create Purchase'}</button>
        </form>
      </Modal>
    </motion.div>
  );
};

export default Purchases;
