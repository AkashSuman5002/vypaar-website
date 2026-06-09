import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Plus, X, Trash2, Save, Share2, Upload, ChevronDown, Loader2,
  StickyNote, ListChecks, Camera, GripVertical, MessageSquare, Mail, Link2,
  Calculator, Delete, Settings as SettingsIcon,
} from 'lucide-react';
import { purchaseAPI, supplierAPI, productAPI, fetchCsrfToken } from '../services/api';
import { formatCurrency } from '../utils/format';
import useSettings from '../hooks/useSettings';

const UNITS = ['NONE', 'Pcs', 'Kg', 'G', 'L', 'Ml', 'M', 'Box', 'Pack', 'Dozen', 'Pair', 'Set', 'Bag'];
const DEFAULT_GST_RATES = [0, 3, 5, 12, 18, 28];
const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Ladakh','Lakshadweep','Puducherry'];
const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card', 'Credit'];
const PAYMENT_TYPES_EXTRA = ['NEFT', 'RTGS', 'IMPS', 'Wallet'];

const newItem = (id) => ({
  _id: id || Date.now() + Math.random(),
  product: '',
  productName: '',
  description: '',
  hsn: '',
  quantity: 0,
  unit: 'NONE',
  priceMode: 'Without Tax',
  rate: 0,
  mrp: 0,
  discountType: 'percent',
  discountValue: 0,
  discountAmount: 0,
  gstRate: 0,
  taxAmount: 0,
  amount: 0,
  taxableAmount: 0,
  lastPurchasePrice: 0,
});

const CreatePurchaseBill = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);
  const billUploadRef = useRef(null);
  const { business, getPref } = useSettings();

  const savedTaxRates = getPref('taxes', 'taxRates');
  const GST_RATES = savedTaxRates?.length ? savedTaxRates.map(r => r.igst) : DEFAULT_GST_RATES;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [billFile, setBillFile] = useState(null);

  const [form, setForm] = useState({
    party: '',
    partyName: '',
    phone: '',
    billNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    stateOfSupply: '',
    items: [newItem()],
    paymentType: 'Cash',
    roundOffEnabled: false,
    roundOff: 0,
    terms: '',
    description: '',
    notes: '',
    taxableAmount: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 0,
    paidAmount: 0,
    paymentStatus: 'unpaid',
  });

  const [payments, setPayments] = useState([]);
  const [activePaymentIdx, setActivePaymentIdx] = useState(0);

  const currency = getPref('general', 'businessCurrency') || 'INR';
  const decimalPlaces = parseInt(getPref('general', 'amountDecimalPlaces') || '2');
  const fmt = (amt) => formatCurrency(amt, currency, decimalPlaces);
  const purchaseOrderPrefix = getPref('transaction', 'purchaseOrderPrefix') || 'PUR-';
  const lastPurchasePriceEnabled = getPref('transaction', 'lastPurchasePrice');

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken();
        const [supRes, prodRes] = await Promise.all([
          supplierAPI.getAll().catch(() => ({ data: [] })),
          productAPI.getAll().catch(() => ({ data: [] })),
        ]);
        const supData = Array.isArray(supRes.data) ? supRes.data : supRes.data?.suppliers || [];
        const prodData = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.products || [];
        setSuppliers(supData);
        setProducts(prodData);

        if (isEdit) {
          const { data } = await purchaseAPI.getById(id);
          setForm({
            party: data.supplier?._id || data.supplier || '',
            partyName: data.supplierName || '',
            phone: data.phone || '',
            billNumber: data.billNumber || '',
            billDate: data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0],
            stateOfSupply: data.stateOfSupply || '',
            items: data.items?.length ? data.items.map((i, idx) => ({
              _id: Date.now() + idx,
              product: i.product?._id || i.product || '',
              productName: i.productName || '',
              description: i.description || '',
              hsn: i.hsn || '',
              quantity: i.quantity || 0,
              unit: i.unit || 'NONE',
              priceMode: 'Without Tax',
              rate: i.rate || 0,
              mrp: i.mrp || 0,
              discountType: 'percent',
              discountValue: 0,
              discountAmount: i.discountAmount || 0,
              gstRate: i.gstRate || 0,
              taxAmount: (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0),
              amount: i.amount || 0,
              taxableAmount: i.taxableAmount || 0,
              lastPurchasePrice: 0,
            })) : [newItem()],
            paymentType: data.paymentMethod ? (data.paymentMethod.charAt(0).toUpperCase() + data.paymentMethod.slice(1)) : 'Cash',
            roundOffEnabled: false,
            roundOff: 0,
            terms: data.notes || '',
            description: data.description || '',
            notes: '',
            taxableAmount: data.taxableAmount || 0,
            discountTotal: 0,
            taxTotal: (data.cgstTotal || 0) + (data.sgstTotal || 0) + (data.igstTotal || 0),
            totalAmount: data.totalAmount || 0,
            paidAmount: data.paidAmount || 0,
            paymentStatus: data.paymentStatus || 'unpaid',
          });
          setOpenTabs([{ id: 'edit', label: `Edit Purchase${data.billNumber ? ' #' + data.billNumber : ''}` }]);
          if (lastPurchasePriceEnabled && data.items?.length) {
            data.items.forEach((item, idx) => {
              const pid = item.product?._id || item.product;
              if (pid) {
                productAPI.getLastPurchasePrice(pid).then(({ data: lpp }) => {
                  setForm(prev => {
                    const items = [...prev.items];
                    if (items[idx]) {
                      items[idx] = { ...items[idx], lastPurchasePrice: lpp.lastPrice || 0 };
                      return { ...prev, items };
                    }
                    return prev;
                  });
                }).catch(() => {});
              }
            });
          }
        } else {
          const nextNum = `${purchaseOrderPrefix}${Date.now().toString(36).toUpperCase().slice(-6)}`;
          setForm(f => ({ ...f, billNumber: nextNum }));
          setOpenTabs([{ id: '1', label: 'Purchase #1' }]);
        }
      } catch (err) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit]);

  const handlePartySelect = (partyId) => {
    const sup = suppliers.find(s => s._id === partyId);
    setForm(prev => ({
      ...prev,
      party: partyId,
      partyName: sup?.name || '',
      phone: sup?.phone || '',
      stateOfSupply: sup?.state || '',
    }));
  };

  const calculateItem = useCallback((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const base = qty * rate;
    const discType = item.discountType;
    const discVal = parseFloat(item.discountValue) || 0;
    let discAmt = 0;
    if (discType === 'percent') discAmt = base * discVal / 100;
    else if (discType === 'amount') discAmt = Math.min(discVal, base);
    const taxable = Math.max(0, base - discAmt);
    const gstRate = parseFloat(item.gstRate) || 0;
    const taxAmt = taxable * gstRate / 100;
    const amount = taxable + taxAmt;
    return { ...item, discountAmount: discAmt, taxableAmount: taxable, taxAmount: taxAmt, amount };
  }, []);

  const updateItem = useCallback((idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product' && value) {
        const prod = products.find(p => p._id === value);
        if (prod) {
          items[idx].productName = prod.name;
          items[idx].rate = prod.purchasePrice || prod.costPrice || prod.price || 0;
          items[idx].mrp = prod.mrp || prod.price || 0;
          items[idx].unit = prod.unit || 'NONE';
          items[idx].hsn = prod.hsn || '';
          items[idx].gstRate = prod.gstRate || 0;
          items[idx].description = prod.description || '';
        }
      }
      items[idx] = calculateItem(items[idx]);
      return { ...prev, items };
    });

    if (field === 'product' && value && lastPurchasePriceEnabled) {
      productAPI.getLastPurchasePrice(value).then(({ data }) => {
        setForm(prev => {
          const items = [...prev.items];
          if (items[idx] && items[idx].product === value) {
            items[idx] = { ...items[idx], lastPurchasePrice: data.lastPrice || 0 };
            return { ...prev, items };
          }
          return prev;
        });
      }).catch(() => {});
    }
  }, [products, calculateItem, lastPurchasePriceEnabled]);

  const addRow = () => setForm(prev => ({ ...prev, items: [...prev.items, newItem()] }));
  const removeRow = (idx) => {
    if (form.items.length === 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const totals = useMemo(() => {
    const taxableAmount = form.items.reduce((s, i) => s + (parseFloat(i.taxableAmount) || 0), 0);
    const discountTotal = form.items.reduce((s, i) => s + (parseFloat(i.discountAmount) || 0), 0);
    const taxTotal = form.items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0);
    let total = taxableAmount + taxTotal;
    let roundOff = 0;
    if (form.roundOffEnabled) {
      roundOff = Math.round(total) - total;
      total = Math.round(total);
    } else {
      roundOff = parseFloat(form.roundOff) || 0;
      total = total + roundOff;
    }
    return { taxableAmount, discountTotal, taxTotal, total, roundOff };
  }, [form.items, form.roundOffEnabled, form.roundOff]);

  useEffect(() => {
    setForm(prev => ({ ...prev, taxableAmount: totals.taxableAmount, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, totalAmount: totals.total }));
  }, [totals.taxableAmount, totals.discountTotal, totals.taxTotal, totals.total]);

  const closeTab = (tabId) => {
    if (tabId === '1' && !isEdit) return;
    if (openTabs.length === 1) {
      navigate('/purchases/bills');
      return;
    }
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    if (isEdit) navigate('/purchases/bills');
  };

  const addNewTab = () => {
    const newNum = openTabs.length + 1;
    setOpenTabs(prev => [...prev, { id: String(newNum), label: `Purchase #${newNum}` }]);
    setForm({
      party: '', partyName: '', phone: '',
      billNumber: `${purchaseOrderPrefix}${Math.floor(1000 + Math.random() * 9000)}`,
      billDate: new Date().toISOString().split('T')[0],
      stateOfSupply: '',
      items: [newItem()],
      paymentType: 'Cash',
      roundOffEnabled: false, roundOff: 0,
      terms: '', description: '', notes: '',
      taxableAmount: 0, discountTotal: 0, taxTotal: 0, totalAmount: 0,
      paidAmount: 0, paymentStatus: 'unpaid',
    });
    navigate('/purchases/bills/new');
  };

  const handleSave = async (action = 'save') => {
    if (!form.partyName) {
      toast.error('Party name is required');
      return;
    }
    if (form.items.length === 0 || form.items.every(i => !i.productName)) {
      toast.error('At least one item is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        supplier: form.party || undefined,
        supplierName: form.partyName,
        phone: form.phone,
        billNumber: form.billNumber,
        date: form.billDate,
        stateOfSupply: form.stateOfSupply,
        items: form.items.filter(i => i.productName).map(i => {
          const isIGST = business?.state && form.stateOfSupply && business.state !== form.stateOfSupply;
          return {
            product: i.product || undefined,
            productName: i.productName,
            description: i.description,
            hsn: i.hsn,
            quantity: parseFloat(i.quantity) || 0,
            unit: i.unit,
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0,
            gstRate: parseFloat(i.gstRate) || 0,
            taxableAmount: parseFloat(i.taxableAmount) || 0,
            cgst: isIGST ? 0 : (parseFloat(i.taxAmount) || 0) / 2,
            sgst: isIGST ? 0 : (parseFloat(i.taxAmount) || 0) / 2,
            igst: isIGST ? (parseFloat(i.taxAmount) || 0) : 0,
            discountAmount: parseFloat(i.discountAmount) || 0,
          };
        }),
        taxableAmount: totals.taxableAmount,
        cgstTotal: business?.state && form.stateOfSupply && business.state !== form.stateOfSupply ? 0 : totals.taxTotal / 2,
        sgstTotal: business?.state && form.stateOfSupply && business.state !== form.stateOfSupply ? 0 : totals.taxTotal / 2,
        igstTotal: business?.state && form.stateOfSupply && business.state !== form.stateOfSupply ? totals.taxTotal : 0,
        totalAmount: totals.total,
        paidAmount: totalPaid > 0 ? totalPaid : parseFloat(form.paidAmount) || 0,
        paymentStatus: (totalPaid > 0 ? totalPaid : parseFloat(form.paidAmount) || 0) >= totals.total ? 'paid' : (totalPaid > 0 ? totalPaid : parseFloat(form.paidAmount) || 0) > 0 ? 'partial' : 'unpaid',
        paymentMethod: (form.paymentType || 'Cash').toLowerCase(),
        payments: payments.length > 0 ? payments.map(p => ({ mode: p.mode, amount: parseFloat(p.amount) || 0, date: p.date, reference: p.reference })) : undefined,
        notes: form.terms || form.description || '',
        isInterState: business?.state && form.stateOfSupply && business.state !== form.stateOfSupply,
      };
      let res;
      if (isEdit) {
        res = await purchaseAPI.update(id, payload);
        toast.success('Purchase bill updated');
      } else {
        res = await purchaseAPI.create(payload);
        toast.success('Purchase bill saved');
      }
      if (action === 'save_new') {
        addNewTab();
      } else {
        navigate('/purchases/bills');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = (mode) => {
    if (payments.find(p => p.mode === mode)) return;
    setPayments(prev => [...prev, { mode, amount: 0, date: form.billDate, reference: '' }]);
    setActivePaymentIdx(payments.length);
  };

  const updatePayment = (idx, field, value) => {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removePayment = (idx) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [payments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Top Tabs Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 pt-2 flex items-end gap-1 overflow-x-auto">
        {openTabs.map(tab => (
          <div key={tab.id}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-b-0 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-t-lg whitespace-nowrap group min-w-[180px]"
          >
            <span className="truncate">{tab.label}</span>
            <button onClick={() => closeTab(tab.id)} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addNewTab}
          className="mb-1 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors bg-white dark:bg-slate-800"
          title="Open new tab"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1 mb-1">
          <button onClick={() => setShowCalculator(true)} className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="Calculator">
            <Calculator className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/settings?tab=transaction')} className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors" title="Transaction Settings">
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/purchases/bills')} className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title Row */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase</h1>
      </div>

      {/* Top Form Section */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Party <span className="text-red-500">*</span>
            </label>
            <select value={form.party} onChange={e => handlePartySelect(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-blue-400 dark:border-blue-500 rounded-lg bg-white dark:bg-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            >
              <option value="">Select Party</option>
              {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <input value={form.partyName} onChange={e => setForm({ ...form, partyName: e.target.value })}
              placeholder="Or type party name"
              className="w-full mt-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone No.</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone No."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 text-right">Bill Number</label>
            <input value={form.billNumber} onChange={e => setForm({ ...form, billNumber: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 text-right">Bill Date</label>
            <input type="date" value={form.billDate} onChange={e => setForm({ ...form, billDate: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 text-right">State of supply</label>
            <select value={form.stateOfSupply} onChange={e => setForm({ ...form, stateOfSupply: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-slate-800 p-4">
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/50">
                <th className="px-2 py-3 text-center w-10">#</th>
                <th className="px-2 py-3 text-left min-w-[200px]">ITEM</th>
                <th className="px-2 py-3 text-center w-20">QTY</th>
                <th className="px-2 py-3 text-center w-20">UNIT</th>
                <th className="px-2 py-3 text-right w-32" colSpan={1}>
                  <div className="flex flex-col items-end gap-1">
                    <span>PRICE/UNIT</span>
                    <select value={form.items[0]?.priceMode || 'Without Tax'} onChange={e => setForm(prev => ({ ...prev, items: prev.items.map(it => ({ ...it, priceMode: e.target.value })) }))}
                      className="text-[10px] px-1 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <option>Without Tax</option>
                      <option>With Tax</option>
                    </select>
                  </div>
                </th>
                <th className="px-2 py-3 text-center w-32" colSpan={2}>
                  <div className="flex flex-col items-center">
                    <span>DISCOUNT</span>
                    <div className="flex w-full mt-1 text-[10px] font-normal text-slate-500">
                      <span className="flex-1 text-center">%</span>
                      <span className="flex-1 text-center">AMOUNT</span>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-3 text-center w-32" colSpan={2}>
                  <div className="flex flex-col items-center">
                    <span>TAX</span>
                    <div className="flex w-full mt-1 text-[10px] font-normal text-slate-500">
                      <span className="flex-1 text-center">%</span>
                      <span className="flex-1 text-center">AMOUNT</span>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-3 text-right w-28">AMOUNT</th>
                <th className="px-2 py-3 w-10">
                  <button onClick={addRow} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Add row">
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={item._id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-2 py-2 text-center text-slate-400 text-xs font-medium align-top pt-3">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3 h-3 text-slate-300" />
                      <span>{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">Select Item</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    <input value={item.productName} onChange={e => updateItem(idx, 'productName', e.target.value)}
                      placeholder="Item name"
                      className="w-full mt-1 px-2 py-1 text-xs border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input type="number" min="0" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className="w-full px-1 py-1.5 text-xs border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center">
                      <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                      />
                      {lastPurchasePriceEnabled && item.lastPurchasePrice > 0 && (
                        <span className="text-xs text-blue-600 ml-1 whitespace-nowrap" title="Last Purchase Price">
                          (Last: {fmt(item.lastPurchasePrice)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top w-16">
                    <div className="flex items-center">
                      <input type="number" min="0" value={item.discountValue} onChange={e => updateItem(idx, 'discountValue', e.target.value)}
                        className="w-full px-1 py-1.5 text-xs text-right border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top w-24">
                    <div className="px-1 py-1.5 text-xs text-right text-slate-700 dark:text-slate-200 font-medium">
                      {fmt(item.discountAmount || 0)}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top w-20">
                    <select value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)}
                      className="w-full px-1 py-1.5 text-xs border-b border-slate-200 dark:border-slate-600 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500"
                    >
                      {GST_RATES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top w-24">
                    <div className="px-1 py-1.5 text-xs text-right text-slate-700 dark:text-slate-200 font-medium">
                      {fmt(item.taxAmount || 0)}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top pt-3">
                    {fmt(item.amount || 0)}
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-2">
                    {form.items.length > 1 && (
                      <button onClick={() => removeRow(idx)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <td colSpan={4} className="px-3 py-3">
                  <button onClick={addRow} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors">
                    <Plus className="w-4 h-4" /> ADD ROW
                  </button>
                </td>
                <td className="px-2 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL</td>
                <td colSpan={2} className="px-2 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(totals.discountTotal)}
                </td>
                <td colSpan={2} className="px-2 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(totals.taxTotal)}
                </td>
                <td className="px-2 py-3 text-right text-sm font-bold text-slate-900 dark:text-slate-100">
                  {fmt(totals.total)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Add buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setShowTerms(true)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.terms ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                {form.terms ? '✓ Terms Added' : 'ADD TERMS AND CONDITIONS'}
              </button>

              <div className="relative">
                <button onClick={() => setShowPayment(!showPayment)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                  + Add Payment type
                </button>
                <AnimatePresence>
                  {showPayment && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="absolute z-20 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg p-1"
                    >
                      {[...PAYMENT_MODES, ...PAYMENT_TYPES_EXTRA].filter(m => !payments.find(p => p.mode === m)).map(mode => (
                        <button key={mode} onClick={() => { handleAddPayment(mode); setShowPayment(false); }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded transition-colors"
                        >
                          {mode}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button onClick={() => setShowDesc(true)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.description ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              {form.description ? '✓ Description Added' : 'ADD DESCRIPTION'}
            </button>

            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { setImageFile(e.target.files[0]); toast.success('Image added'); }} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${imageFile ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
              >
                <Camera className="w-3.5 h-3.5" />
                {imageFile ? `✓ ${imageFile.name.slice(0, 16)}...` : 'ADD IMAGE'}
              </button>
            </div>

            {payments.length > 0 && (
              <div className="mt-3 space-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Payments</p>
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 w-20">{p.mode}</span>
                    <input type="number" value={p.amount} onChange={e => updatePayment(idx, 'amount', e.target.value)}
                      placeholder="Amount" className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                    <input type="date" value={p.date} onChange={e => updatePayment(idx, 'date', e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                    <button onClick={() => removePayment(idx)} className="p-1 text-slate-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-slate-500">Total Paid: <span className="font-semibold text-emerald-600">{fmt(totalPaid)}</span></p>
              </div>
            )}
          </div>

          {/* Right: Totals */}
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-2 text-sm py-1">
              <span className="text-slate-500">Taxable Amount</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums">{fmt(totals.taxableAmount)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex items-center justify-end gap-2 text-sm py-1">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium text-rose-500 w-32 text-right tabular-nums">−{fmt(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 text-sm py-1">
              <span className="text-slate-500">Tax</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums">{fmt(totals.taxTotal)}</span>
            </div>
            <div className="flex items-center justify-end gap-2 text-sm py-2 border-t border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                <input type="checkbox" checked={form.roundOffEnabled} onChange={e => setForm({ ...form, roundOffEnabled: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Round Off</span>
              </label>
              <input type="number" step="0.01" value={totals.roundOff} readOnly
                className="w-24 px-2 py-1 text-sm text-right border-b border-slate-300 bg-transparent"
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-base font-bold py-2 border-t-2 border-slate-300 dark:border-slate-600">
              <span className="text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-slate-900 dark:text-slate-100 w-32 text-right tabular-nums text-lg">{fmt(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Type + Action Buttons */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Type</label>
          <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input ref={billUploadRef} type="file" accept="image/*,application/pdf" onChange={e => { setBillFile(e.target.files[0]); toast.success('Bill uploaded'); }} className="hidden" />
          <button onClick={() => billUploadRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {billFile ? `✓ ${billFile.name.slice(0, 14)}...` : 'Upload Bill'}
          </button>

          <div className="relative">
            <button onClick={() => setShareOpen(!shareOpen)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {shareOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-1"
                  >
                    {[
                      { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600' },
                      { label: 'Email', icon: Mail, color: 'text-blue-600' },
                      { label: 'Copy Link', icon: Link2, color: 'text-slate-600' },
                      { label: 'SMS', icon: MessageSquare, color: 'text-violet-600' },
                    ].map(opt => (
                      <button key={opt.label} onClick={() => { toast.info(`${opt.label} share coming soon`); setShareOpen(false); }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
                      >
                        <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => handleSave('save')}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showTerms && (
          <Modal title="Terms and Conditions" onClose={() => setShowTerms(false)} onClear={() => setForm(f => ({ ...f, terms: '' }))}>
            <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={6}
              placeholder="Enter terms and conditions..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
            />
          </Modal>
        )}
        {showDesc && (
          <Modal title="Description" onClose={() => setShowDesc(false)} onClear={() => setForm(f => ({ ...f, description: '' }))}>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6}
              placeholder="Add description or notes..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none"
            />
          </Modal>
        )}
      </AnimatePresence>

      <CalculatorPopup
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        onUse={(value) => {
          setForm(f => ({
            ...f,
            items: [...f.items, newItem(Date.now())].map((it, idx) =>
              idx === f.items.length
                ? { ...it, productName: 'Calculator total', quantity: 1, rate: parseFloat(value.toFixed(2)), amount: parseFloat(value.toFixed(2)), taxableAmount: parseFloat(value.toFixed(2)), taxAmount: 0, discountAmount: 0 }
                : it
            ),
          }));
          setShowCalculator(false);
          toast.success('Amount added as new item');
        }}
      />
    </div>
  );
};

const Modal = ({ title, children, onClose, onClear }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
      className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>
      {children}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClear} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">Clear</button>
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">Done</button>
      </div>
    </motion.div>
  </motion.div>
);

const CalculatorPopup = ({ open, onClose, onUse }) => {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (d) => {
    if (waitingForOperand) { setDisplay(String(d)); setWaitingForOperand(false); }
    else setDisplay(display === '0' ? String(d) : display + d);
  };
  const inputDot = () => {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const clearAll = () => { setDisplay('0'); setPrevious(null); setOperator(null); setWaitingForOperand(false); };
  const backspace = () => {
    if (waitingForOperand) return;
    if (display.length === 1) setDisplay('0');
    else setDisplay(display.slice(0, -1));
  };
  const compute = (a, b, op) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      case '%': return (a * b) / 100;
      default: return b;
    }
  };
  const round = (n) => Math.round(n * 1e10) / 1e10;
  const performOp = (nextOp) => {
    const inputValue = parseFloat(display);
    if (previous == null) setPrevious(inputValue);
    else if (operator) {
      const result = compute(previous, inputValue, operator);
      setDisplay(String(round(result)));
      setPrevious(parseFloat(round(result)));
    }
    setWaitingForOperand(true);
    setOperator(nextOp);
  };
  const equals = () => {
    if (operator == null || previous == null) return;
    const result = compute(previous, parseFloat(display), operator);
    setDisplay(String(round(result)));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  useEffect(() => { if (!open) clearAll(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDot();
      else if (e.key === '+' || e.key === '-') performOp(e.key);
      else if (e.key === '*') performOp('×');
      else if (e.key === '/') { e.preventDefault(); performOp('÷'); }
      else if (e.key === '%') performOp('%');
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onClose();
      else if (e.key.toLowerCase() === 'c') clearAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, display, previous, operator, waitingForOperand]);

  const currentValue = parseFloat(display) || 0;
  const Btn = ({ children, onClick, variant = 'num', className = '' }) => {
    const variants = {
      num: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200',
      op: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100',
      eq: 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600',
      util: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
    };
    return (
      <button type="button" onClick={onClick}
        className={`h-12 rounded-lg text-base font-semibold transition-colors active:scale-95 ${variants[variant]} ${className}`}
      >{children}</button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <Calculator className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Calculator</h3>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4 bg-slate-900">
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-white tabular-nums truncate">
                  {display.length > 14 ? Number(display).toExponential(6) : display}
                </p>
                {operator && previous != null && <p className="text-xs text-slate-400 mt-0.5">{previous} {operator}</p>}
              </div>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2">
              <Btn variant="util" onClick={clearAll}>AC</Btn>
              <Btn variant="util" onClick={backspace}><Delete className="w-4 h-4 mx-auto" /></Btn>
              <Btn variant="op" onClick={() => performOp('%')}>%</Btn>
              <Btn variant="op" onClick={() => performOp('÷')}>÷</Btn>
              <Btn variant="num" onClick={() => inputDigit(7)}>7</Btn>
              <Btn variant="num" onClick={() => inputDigit(8)}>8</Btn>
              <Btn variant="num" onClick={() => inputDigit(9)}>9</Btn>
              <Btn variant="op" onClick={() => performOp('×')}>×</Btn>
              <Btn variant="num" onClick={() => inputDigit(4)}>4</Btn>
              <Btn variant="num" onClick={() => inputDigit(5)}>5</Btn>
              <Btn variant="num" onClick={() => inputDigit(6)}>6</Btn>
              <Btn variant="op" onClick={() => performOp('-')}>−</Btn>
              <Btn variant="num" onClick={() => inputDigit(1)}>1</Btn>
              <Btn variant="num" onClick={() => inputDigit(2)}>2</Btn>
              <Btn variant="num" onClick={() => inputDigit(3)}>3</Btn>
              <Btn variant="op" onClick={() => performOp('+')}>+</Btn>
              <Btn variant="num" onClick={() => inputDigit(0)} className="col-span-2">0</Btn>
              <Btn variant="num" onClick={inputDot}>.</Btn>
              <Btn variant="eq" onClick={equals}>=</Btn>
            </div>
            <div className="px-3 pb-3">
              <button type="button" onClick={() => onUse(currentValue)}
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
                Use {formatCurrency(currentValue)} as Item
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">Keyboard: 0-9 + − × ÷ % Enter = Esc C ⌫</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreatePurchaseBill;
