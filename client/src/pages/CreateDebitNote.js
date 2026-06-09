import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Save, ArrowLeft, X, Calculator, Settings, Share2,
  Camera, Image as ImageIcon, FileText, ChevronDown, Loader2,
} from 'lucide-react';
import { supplierAPI, productAPI, purchaseReturnAPI, fetchCsrfToken } from '../services/api';
import useSettings from '../hooks/useSettings';

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair', 'none'];
const DEFAULT_GST_RATES = [0, 3, 5, 12, 18, 28];
const REASONS = ['Damaged Goods', 'Defective Product', 'Wrong Item', 'Excess Quantity', 'Quality Issue', 'Other'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const CalcPopup = ({ open, onClose, onUse }) => {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const round = (n) => Math.round(n * 1e10) / 1e10;

  const compute = (a, b, operator) => {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      case '%': return a % b;
      default: return b;
    }
  };

  const inputDigit = (d) => {
    if (waiting) { setDisplay(String(d)); setWaiting(false); }
    else setDisplay(display === '0' ? String(d) : display + d);
  };

  const inputDot = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };

  const performNext = (nextOp) => {
    const cur = parseFloat(display);
    if (prev !== null && op && !waiting) {
      const result = round(compute(prev, cur, op));
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(cur);
    }
    setOp(nextOp);
    setWaiting(true);
  };

  const equals = () => {
    const cur = parseFloat(display);
    if (prev !== null && op) {
      const result = round(compute(prev, cur, op));
      setDisplay(String(result));
      setPrev(null);
      setOp(null);
      setWaiting(false);
    }
  };

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false); };
  const backspace = () => { if (display.length > 1) setDisplay(display.slice(0, -1)); else setDisplay('0'); };
  const percent = () => { setDisplay(String(parseFloat(display) / 100)); };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDot();
      else if (e.key === '+') performNext('+');
      else if (e.key === '-') performNext('-');
      else if (e.key === '*') performNext('×');
      else if (e.key === '/') { e.preventDefault(); performNext('÷'); }
      else if (e.key === '%') percent();
      else if (e.key === 'Enter' || e.key === '=') equals();
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'c' || e.key === 'C') clear();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, display, prev, op, waiting]);

  if (!open) return null;
  const btn = 'h-11 rounded-lg text-sm font-semibold transition-all active:scale-95';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-20 right-6 z-50 bg-gray-900 rounded-2xl shadow-2xl p-4 w-72 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calculator</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="bg-gray-800 rounded-xl p-3 mb-3">
        <div className="text-xs text-gray-500 h-4">{prev !== null ? `${prev} ${op}` : ''}</div>
        <div className="text-2xl font-bold text-white text-right truncate">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={clear} className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600`}>AC</button>
        <button onClick={backspace} className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600`}>⌫</button>
        <button onClick={percent} className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600`}>%</button>
        <button onClick={() => performNext('÷')} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>÷</button>
        {[7,8,9].map(d => <button key={d} onClick={() => inputDigit(d)} className={`${btn} bg-gray-800 text-white hover:bg-gray-700`}>{d}</button>)}
        <button onClick={() => performNext('×')} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>×</button>
        {[4,5,6].map(d => <button key={d} onClick={() => inputDigit(d)} className={`${btn} bg-gray-800 text-white hover:bg-gray-700`}>{d}</button>)}
        <button onClick={() => performNext('-')} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>−</button>
        {[1,2,3].map(d => <button key={d} onClick={() => inputDigit(d)} className={`${btn} bg-gray-800 text-white hover:bg-gray-700`}>{d}</button>)}
        <button onClick={() => performNext('+')} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>+</button>
        <button onClick={() => inputDigit(0)} className={`${btn} bg-gray-800 text-white hover:bg-gray-700 col-span-2`}>0</button>
        <button onClick={inputDot} className={`${btn} bg-gray-800 text-white hover:bg-gray-700`}>.</button>
        <button onClick={equals} className={`${btn} bg-green-600 text-white hover:bg-green-500`}> =</button>
      </div>
      <button onClick={() => { onUse(parseFloat(display) || 0); onClose(); }}
        className="w-full mt-3 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors">
        Use ₹{display} as Item
      </button>
    </motion.div>
  );
};

const CreateDebitNote = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id;
  const { settings, getPref, business } = useSettings();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const partyRef = useRef(null);
  const phoneRef = useRef(null);
  const fileInputRef = useRef(null);

  const prefix = getPref('transaction', 'creditNotePrefix') || 'DN-';
  const savedTaxRates = getPref('taxes', 'taxRates');
  const GST_RATES = savedTaxRates?.length ? savedTaxRates.map(r => r.igst) : DEFAULT_GST_RATES;

  const [form, setForm] = useState({
    party: '',
    partyId: '',
    phone: '',
    returnNumber: isEdit ? '' : `${prefix}${Date.now().toString(36).toUpperCase().slice(-6)}`,
    invoiceNumber: '',
    invoiceDate: '',
    date: new Date().toISOString().split('T')[0],
    stateOfSupply: '',
    reason: '',
    paymentType: 'Cash',
    roundOff: true,
    roundOffValue: 0,
    description: '',
  });

  const [items, setItems] = useState([newItem(Date.now())]);

  function newItem(ts) {
    return {
      id: ts || Date.now(),
      product: '', productName: '', description: '', hsn: '',
      quantity: 1, unit: 'pcs', rate: 0, gstRate: 0,
      discountPct: 0, discountAmount: 0, taxAmount: 0, amount: 0, taxableAmount: 0,
    };
  }

  useEffect(() => {
    supplierAPI.getAll().then(({ data }) => setSuppliers(data.suppliers || data || [])).catch(() => {});
    productAPI.getAll().then(({ data }) => setProducts(data.products || data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      purchaseReturnAPI.getById(id).then(({ data }) => {
        const r = data.return || data;
        setForm({
          party: r.supplierName || '',
          partyId: r.supplier || '',
          phone: r.phone || '',
          returnNumber: r.returnNumber || '',
          invoiceNumber: r.purchaseBillNumber || '',
          invoiceDate: r.invoiceDate ? r.invoiceDate.split('T')[0] : '',
          date: r.returnDate ? r.returnDate.split('T')[0] : new Date().toISOString().split('T')[0],
          stateOfSupply: r.stateOfSupply || '',
          reason: r.reason || '',
          paymentType: r.paymentType || 'Cash',
          roundOff: true,
          roundOffValue: r.roundOffValue || 0,
          description: r.notes || '',
        });
        if (r.items && r.items.length) {
          setItems(r.items.map((it, i) => ({
            id: Date.now() + i,
            product: it.product || '',
            productName: it.productName || '',
            description: it.description || '',
            hsn: it.hsn || '',
            quantity: it.quantity || 1,
            unit: it.unit || 'pcs',
            rate: it.rate || 0,
            gstRate: it.gstRate || 0,
            discountPct: it.discountPct || 0,
            discountAmount: it.discountAmount || 0,
            taxAmount: it.taxAmount || 0,
            amount: it.amount || 0,
            taxableAmount: it.taxableAmount || 0,
          })));
        }
      }).catch(() => toast.error('Failed to load debit note'));
    }
  }, [id, isEdit]);

  const calcItem = useCallback((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gstRate = parseFloat(item.gstRate) || 0;
    const discountPct = parseFloat(item.discountPct) || 0;
    const gross = qty * rate;
    const discountAmt = gross * discountPct / 100;
    const taxable = gross - discountAmt;
    const taxAmt = taxable * gstRate / 100;
    const amount = taxable + taxAmt;
    return { discountAmount: discountAmt, taxableAmount: taxable, taxAmount: taxAmt, amount };
  }, []);

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      const calc = calcItem(updated);
      return { ...updated, ...calc };
    }));
  };

  const selectProduct = (id, productId) => {
    const p = products.find(pr => pr._id === productId);
    if (!p) return;
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = {
        ...it,
        product: p._id,
        productName: p.name,
        hsn: p.hsn || '',
        unit: p.unit || 'pcs',
        rate: p.salePrice || p.purchasePrice || 0,
        gstRate: p.gstRate || 0,
      };
      const calc = calcItem(updated);
      return { ...updated, ...calc };
    }));
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const totals = items.reduce((acc, it) => ({
    taxableAmount: acc.taxableAmount + (it.taxableAmount || 0),
    discountAmount: acc.discountAmount + (it.discountAmount || 0),
    taxAmount: acc.taxAmount + (it.taxAmount || 0),
    total: acc.total + (it.amount || 0),
  }), { taxableAmount: 0, discountAmount: 0, taxAmount: 0, total: 0 });

  const roundOffVal = form.roundOff ? Math.round(totals.total) - totals.total : 0;
  const grandTotal = totals.total + (form.roundOff ? roundOffVal : parseFloat(form.roundOffValue) || 0);

  const handleSave = async () => {
    if (!form.party.trim()) { toast.error('Supplier is required'); return; }
    if (items.every(it => !it.productName)) { toast.error('At least one item is required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('returnNumber', form.returnNumber);
      fd.append('supplierName', form.party);
      if (form.partyId) fd.append('supplier', form.partyId);
      fd.append('phone', form.phone);
      fd.append('purchaseBillNumber', form.invoiceNumber);
      if (form.invoiceDate) fd.append('invoiceDate', form.invoiceDate);
      fd.append('returnDate', form.date);
      fd.append('stateOfSupply', form.stateOfSupply);
      fd.append('reason', form.reason);
      fd.append('paymentType', form.paymentType);
      fd.append('roundOff', form.roundOff);
      fd.append('roundOffValue', form.roundOff ? roundOffVal : parseFloat(form.roundOffValue) || 0);
      fd.append('items', JSON.stringify(items.map(it => ({
        product: it.product || undefined,
        productName: it.productName,
        description: it.description,
        hsn: it.hsn,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
        rate: parseFloat(it.rate) || 0,
        gstRate: parseFloat(it.gstRate) || 0,
        discountPct: parseFloat(it.discountPct) || 0,
        discountAmount: it.discountAmount || 0,
        taxAmount: it.taxAmount || 0,
        taxableAmount: it.taxableAmount || 0,
        amount: it.amount || 0,
      }))));
      fd.append('taxableAmount', totals.taxableAmount);
      fd.append('cgstTotal', totals.taxAmount / 2);
      fd.append('sgstTotal', totals.taxAmount / 2);
      fd.append('igstTotal', 0);
      fd.append('totalAmount', grandTotal);
      fd.append('notes', form.description);
      fd.append('isInterState', form.stateOfSupply && business?.state && form.stateOfSupply !== business.state);
      if (imageFile) fd.append('image', imageFile);
      if (isEdit) {
        await purchaseReturnAPI.update(id, fd);
        toast.success('Debit note updated');
      } else {
        await purchaseReturnAPI.create(fd);
        toast.success('Debit note created');
      }
      navigate('/purchases/returns');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    !form.party || s.name?.toLowerCase().includes(form.party.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Debit Note</h1>
              <p className="text-xs text-slate-500">{form.returnNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCalculator(!showCalculator)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg text-slate-600 dark:text-slate-300"
              title="Calculator">
              <Calculator className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/settings?tab=transaction')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg text-slate-600 dark:text-slate-300"
              title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg text-slate-600 dark:text-slate-300"
              title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Party & Info Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Party */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative" ref={partyRef}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Party <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.partyId}
                    onChange={(e) => {
                      const s = suppliers.find(su => su._id === e.target.value);
                      if (s) {
                        setForm(f => ({ ...f, party: s.name, partyId: s._id, phone: s.phone || '' }));
                        setItems(prev => prev.map(it => {
                          if (it.product) return it;
                          return it;
                        }));
                      } else {
                        setForm(f => ({ ...f, party: '', partyId: '', phone: '' }));
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                  >
                    <option value="">Select Supplier</option>
                    {filteredSuppliers.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Party
                </button>
              </div>
              <div className="w-40">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone No.</label>
                <input type="tel" ref={phoneRef} value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone No."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Right: Info fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Return No.</label>
              <input type="text" value={form.returnNumber}
                onChange={(e) => setForm(f => ({ ...f, returnNumber: e.target.value }))}
                className="w-40 px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Number</label>
              <input type="text" value={form.invoiceNumber}
                onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                placeholder="Invoice Number"
                className="w-40 px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Date</label>
              <input type="date" value={form.invoiceDate}
                onChange={(e) => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                className="w-40 px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
              <input type="date" value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-40 px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">State of supply</label>
              <select value={form.stateOfSupply}
                onChange={(e) => setForm(f => ({ ...f, stateOfSupply: e.target.value }))}
                className="w-40 px-3 py-2 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-600">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">QTY</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">UNIT</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div>PRICE/UNIT</div>
                    <select value="withoutTax" className="mt-1 text-[10px] bg-transparent border-0 p-0 focus:ring-0 text-slate-400 cursor-default">
                      <option>Without Tax</option>
                    </select>
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider" colSpan={2}>DISCOUNT</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider" colSpan={2}>TAX</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">AMOUNT</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-gray-700/30">
                  <th></th><th></th><th></th><th></th><th></th>
                  <th className="px-3 py-1 text-[10px] font-medium text-slate-400 text-right">%</th>
                  <th className="px-3 py-1 text-[10px] font-medium text-slate-400 text-right">AMOUNT</th>
                  <th className="px-3 py-1 text-[10px] font-medium text-slate-400 text-right">%</th>
                  <th className="px-3 py-1 text-[10px] font-medium text-slate-400 text-right">AMOUNT</th>
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-gray-700 hover:bg-slate-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.productName}
                        onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                        placeholder="Item name"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        min="0" step="1"
                        className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.rate || ''}
                        onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                        min="0" step="0.01"
                        className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={item.discountPct || ''}
                        onChange={(e) => updateItem(item.id, 'discountPct', e.target.value)}
                        min="0" max="100" step="0.1"
                        className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={item.discountAmount ? item.discountAmount.toFixed(2) : ''}
                        readOnly
                        className="w-full px-2 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right text-slate-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select value={item.gstRate}
                        onChange={(e) => updateItem(item.id, 'gstRate', e.target.value)}
                        className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {GST_RATES.map(t => <option key={t} value={t}>{t}%</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={item.taxAmount ? item.taxAmount.toFixed(2) : ''}
                        readOnly
                        className="w-full px-2 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-right text-slate-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 text-right">
                      {item.amount ? `₹${item.amount.toFixed(2)}` : '₹0.00'}
                    </td>
                    <td className="px-3 py-2">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(item.id)}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row + Total */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <button onClick={() => setItems(prev => [...prev, newItem(Date.now())])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
              <Plus className="w-4 h-4" /> ADD ROW
            </button>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-300">TOTAL</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Payment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Payment Type</label>
              <div className="flex items-center gap-2">
                <select value={form.paymentType}
                  onChange={(e) => setForm(f => ({ ...f, paymentType: e.target.value }))}
                  className="px-4 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit">Credit</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Payment type
              </button>
            </div>

            {/* Description */}
            <div>
              <button onClick={() => document.getElementById('desc-area')?.focus()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                <FileText className="w-4 h-4" /> ADD DESCRIPTION
              </button>
              <textarea id="desc-area" value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add description..."
                rows={3}
                className="mt-2 w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            {/* Add Image */}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
                if (e.target.files[0]) { setImageFile(e.target.files[0]); toast.success('Image added'); }
              }} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${imageFile ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700'}`}>
                <Camera className="w-4 h-4" />
                {imageFile ? `✓ ${imageFile.name.slice(0, 20)}${imageFile.name.length > 20 ? '...' : ''}` : 'ADD IMAGE'}
              </button>
            </div>
          </div>

          {/* Right: Totals */}
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Sub Total</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">₹{totals.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium text-red-500">-₹{totals.discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Tax</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">₹{totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-gray-700 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.roundOff}
                    onChange={(e) => setForm(f => ({ ...f, roundOff: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Round Off</span>
                </div>
                {form.roundOff ? (
                  <span className="text-sm text-slate-500">₹{roundOffVal.toFixed(2)}</span>
                ) : (
                  <input type="number" value={form.roundOffValue}
                    onChange={(e) => setForm(f => ({ ...f, roundOffValue: e.target.value }))}
                    className="w-24 px-2 py-1 text-sm text-right border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                )}
              </div>
              <div className="border-t border-slate-200 dark:border-gray-700 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">Total</span>
                <span className="text-xl font-bold text-blue-600">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button onClick={() => navigate(-1)}
            className="px-6 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={handleSave} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Calculator Popup */}
      <CalcPopup open={showCalculator} onClose={() => setShowCalculator(false)}
        onUse={(value) => {
          setItems(prev => [...prev, {
            ...newItem(Date.now()),
            productName: 'Calculator Item',
            quantity: 1,
            rate: value,
            amount: value,
            taxableAmount: value,
          }]);
          toast.success('Amount added as new item');
        }}
      />
    </motion.div>
  );
};

export default CreateDebitNote;
