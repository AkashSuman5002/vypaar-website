import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  ArrowLeft, FileText, Hash, Calendar, User, Phone, Mail, MapPin, BadgePercent,
  Plus, Trash2, Package, IndianRupee, Save, Download, Share2, MessageSquare,
  Send, AlertCircle, CheckCircle, Clock, Search, Loader2, CreditCard, Building2,
  Wallet, Landmark, Zap, X, Printer, HelpCircle, GripVertical, Copy, Truck,
  FileDigit, Receipt, PenLine, Layers, Settings2, Play, BarChart3, ChevronDown,
  Box, Barcode, Tag, Eye, EyeOff, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { saleAPI, customerAPI, productAPI, settingAPI, partyRateAPI, loyaltyAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import useSettings from '../hooks/useSettings';

const DEFAULT_GST_RATES = [0, 3, 5, 12, 18, 28];
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Wallet, color: 'emerald' },
  { value: 'upi', label: 'UPI', icon: Zap, color: 'violet' },
  { value: 'bank', label: 'Bank', icon: Landmark, color: 'blue' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'purple' },
  { value: 'cheque', label: 'Cheque', icon: FileDigit, color: 'amber' },
  { value: 'credit', label: 'Credit', icon: HelpCircle, color: 'rose' },
];
const UNITS = ['Pcs', 'Kg', 'G', 'L', 'Ml', 'M', 'Box', 'Pack', 'Dozen', 'Pair', 'Set', 'Bag'];

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

const emptyItem = () => ({
  _id: Date.now(), product: '', productName: '', description: '', hsn: '',
  quantity: 1, freeQuantity: 0, unit: 'Pcs', rate: 0, mrp: 0,
  amount: 0, gstRate: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0,
  discountType: 'none', discountValue: 0, discountAmount: 0,
  costPrice: 0, batchNo: '', expiryDate: '', serialNo: '', isService: false,
});

const DOC_TYPE_LABELS = { invoice: 'Invoice', estimate: 'Estimate', quotation: 'Quotation', proforma: 'Proforma', order: 'Sale Order', challan: 'Delivery Challan', credit_note: 'Credit Note' };
const DOC_TYPE_NUMBERS = { estimate: 'EST', quotation: 'QUO', proforma: 'PRO', order: 'SO', challan: 'DC', credit_note: 'CN', invoice: 'SALE' };

const CreateSale = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const pathDocType = location.pathname.includes('/estimates/new') ? 'estimate' : location.pathname.includes('/proforma/new') ? 'proforma' : location.pathname.includes('/orders/new') ? 'order' : location.pathname.includes('/challans/new') ? 'challan' : location.pathname.includes('/returns/new') ? 'credit_note' : null;
  const docType = location.state?.documentType || searchParams.get('type') || pathDocType || 'invoice';
  const isEdit = Boolean(id);
  const { getPref, business } = useSettings();
  const productSearchRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerCreditLimit, setCustomerCreditLimit] = useState(0);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({ details: true, customer: true, items: true, charges: true, payment: true, notes: true });
  const [openModal, setOpenModal] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [cashMode, setCashMode] = useState(false);
  const [partyRates, setPartyRates] = useState([]);
  const [loyaltyPointsBalance, setLoyaltyPointsBalance] = useState(0);

  const [form, setForm] = useState({
    invoiceNumber: '', type: docType, status: 'confirmed',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    referenceNumber: '', salesPerson: '',
    customer: '', customerName: '', customerPhone: '', customerEmail: '',
    customerGst: '', customerType: '', customerState: '',
    billingAddress: '', shippingAddress: '', isInterState: false,
    branch: '', warehouse: '',
    items: [emptyItem()],
    taxableAmount: 0, discountTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, cessTotal: 0, taxTotal: 0,
    shippingCharge: 0, packingCharge: 0, freightCharge: 0, loadingCharge: 0, otherCharge: 0,
    additionalChargesTotal: 0, discountOnInvoice: 0,
    roundOff: 0, roundOffEnabled: false, roundingMethod: 'Normal',
    totalAmount: 0, payments: [], paidAmount: 0, remainingBalance: 0, paymentStatus: 'unpaid',
    eWayBill: '', transportMode: '', vehicleNo: '', poNumber: '',
    reverseCharge: false, notes: '', internalNotes: '', termsConditions: '',
    isRecurring: false, recurringFrequency: 'monthly', recurringNextDate: '', recurringEndDate: '', recurringMaxCount: 0,
  });

  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', openingBalance: 0 });

  const currency = getPref('general', 'businessCurrency') || 'INR';
  const decimalPlaces = parseInt(getPref('general', 'amountDecimalPlaces') || '2');
  const fmt = (amt) => formatCurrency(amt, currency, decimalPlaces);
  const gstEnabled = getPref('taxes', 'enableGST');
  const roundOffEnabled = getPref('transaction', 'roundOffTotal');
  const roundingMethod = getPref('transaction', 'roundingMethod');
  const additionalChargesEnabled = getPref('transaction', 'additionalCharges');
  const termsEnabled = getPref('transaction', 'termsAndConditions');
  const transportEnabled = getPref('transaction', 'transportationDetails');
  const eWayBillEnabled = getPref('transaction', 'eWayBillNo');
  const poEnabled = getPref('transaction', 'customerPODetails');
  const dueDatesEnabled = getPref('transaction', 'dueDatesPaymentTerms');
  const showProfit = getPref('transaction', 'showProfitWhileCreatingInvoice');
  const lastSalePriceEnabled = getPref('transaction', 'lastSalePrice');
  const freeQtyEnabled = getPref('transaction', 'freeItemQuantity');
  const billingNamePref = getPref('transaction', 'billingNameOfParties');
  const cashSaleDefault = getPref('transaction', 'cashSaleByDefault');
  const inclusiveTax = getPref('transaction', 'inclusiveExclusiveTax') === 'Inclusive';
  const skipPreview = getPref('transaction', 'doNotShowInvoicePreview');
  const invoiceNoMode = getPref('transaction', 'invoiceNo');
  const cessEnabled = getPref('taxes', 'additionalCess');
  const reverseChargeEnabled = getPref('taxes', 'reverseCharge');
  const placeOfSupplyEnabled = getPref('taxes', 'placeOfSupply');
  const savedTaxRates = getPref('taxes', 'taxRates');
  const GST_RATES = savedTaxRates?.length ? savedTaxRates.map(r => r.igst) : DEFAULT_GST_RATES;
  const shippingAddrEnabled = getPref('party', 'shippingAddress');
  const businessState = business?.state || '';
  const displayPurchasePrice = getPref('transaction', 'displayPurchasePrice');
  const blockNewParties = getPref('general', 'blockNewPartiesFromTransaction');
  const blockNewItems = getPref('general', 'blockNewItemsFromTransaction');
  const managePartyStatus = getPref('party', 'managePartyStatus');
  const stockEnabled = getPref('item', 'stockMaintenance');
  const lowStockDialog = getPref('item', 'lowStockDialog');
  const godownEnabled = getPref('general', 'enableGodown');
  const passcodeForEditDelete = getPref('transaction', 'passcodeForEditDelete');
  const passcodeEnabled = getPref('general', 'enablePasscode');
  const transactionWiseDiscountEnabled = getPref('transaction', 'transactionWiseDiscount');
  const quickEntryEnabled = getPref('transaction', 'quickEntry');
  const transactionWiseTaxEnabled = getPref('transaction', 'transactionWiseTax');
  const additionalFieldsEnabled = getPref('transaction', 'additionalFields');

  const requirePasscode = async (action) => {
    if (!passcodeForEditDelete || !passcodeEnabled) return true;
    const code = window.prompt(`Enter passcode to ${action}:`);
    if (code === null || code.length === 0) return false;
    try {
      const { data } = await settingAPI.verifyPasscode(code);
      if (!data.valid) {
        toast.error('Incorrect passcode');
        return false;
      }
      return true;
    } catch (e) {
      toast.error('Passcode verification failed');
      return false;
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [custRes, prodRes, setRes] = await Promise.all([
          customerAPI.getAll(), productAPI.getAll(), settingAPI.get().catch(() => null),
        ]);
        setCustomers(custRes.data);
        setProducts(prodRes.data);
        setSettings(setRes?.data || null);

        if (isEdit) {
          const { data } = await saleAPI.getById(id);
          setForm({
            invoiceNumber: data.invoiceNumber, type: data.type || 'invoice', status: data.status || 'confirmed',
            date: data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: data.dueDate ? data.dueDate.split('T')[0] : '',
            referenceNumber: data.referenceNumber || '', salesPerson: data.salesPerson || '',
            customer: data.customer?._id || data.customer || '', customerName: data.customerName || '',
            customerPhone: data.customerPhone || '', customerEmail: data.customerEmail || '',
            customerGst: data.customerGst || '', customerType: data.customerType || '',
            customerState: data.customerState || '',
            billingAddress: data.billingAddress || '', shippingAddress: data.shippingAddress || '',
            branch: data.branch || '', warehouse: data.warehouse || '',
            items: data.items?.length ? data.items.map(i => ({ ...i, _id: Date.now() + Math.random() })) : [emptyItem()],
            taxableAmount: data.taxableAmount || 0, discountTotal: data.discountTotal || 0,
            cgstTotal: data.cgstTotal || 0, sgstTotal: data.sgstTotal || 0, igstTotal: data.igstTotal || 0,
            cessTotal: data.cessTotal || 0, taxTotal: data.taxTotal || 0,
            shippingCharge: data.shippingCharge || 0, packingCharge: data.packingCharge || 0,
            freightCharge: data.freightCharge || 0, loadingCharge: data.loadingCharge || 0,
            otherCharge: data.otherCharge || 0, additionalChargesTotal: data.additionalChargesTotal || 0,
            discountOnInvoice: data.discountOnInvoice || 0,
            roundOff: data.roundOff || 0, roundOffEnabled: data.roundOffEnabled || false,
            roundingMethod: data.roundingMethod || 'Normal',
            totalAmount: data.totalAmount || 0,
            payments: data.payments || [],
            paidAmount: data.paidAmount || 0,
            remainingBalance: data.remainingBalance || 0,
            paymentStatus: data.paymentStatus || 'unpaid',
            eWayBill: data.eWayBill || '', transportMode: data.transportMode || '',
            vehicleNo: data.vehicleNo || '', poNumber: data.poNumber || '',
            reverseCharge: data.reverseCharge || false,
            notes: data.notes || '', internalNotes: data.internalNotes || '',
            termsConditions: data.termsConditions || '',
            isRecurring: data.isRecurringTemplate || false, recurringFrequency: data.recurringFrequency || 'monthly',
            recurringNextDate: data.recurringNextDate ? data.recurringNextDate.split('T')[0] : '',
            recurringEndDate: data.recurringEndDate ? data.recurringEndDate.split('T')[0] : '',
            recurringMaxCount: data.recurringMaxCount || 0,
          });
        } else {
          const defaults = {};
          if (invoiceNoMode !== 'Manual') {
            const invRes = await saleAPI.getNextInvoice();
            defaults.invoiceNumber = invRes.data.invoiceNumber;
          }
          if (cashSaleDefault) {
            defaults.payments = [{ mode: 'cash', amount: 0, date: new Date().toISOString().split('T')[0], transactionNo: '', bankName: '', chequeNo: '', referenceNo: '' }];
          }
          setForm(f => ({ ...f, ...defaults }));
        }
      } catch (err) { toast.error('Failed to load data'); }
      finally { setLoading(false); }
    };
    load();
  }, [id, isEdit]);

  const calculate = useCallback((items, paidAmt, payments, discOnInvoice) => {
    let taxableAmount = 0, discountTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, cessTotal = 0;
    const totalItems = items.length;
    let totalQuantity = 0;

    const calcItems = items.map(item => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      totalQuantity += qty;

      let discAmt = 0;
      if (item.discountType === 'percentage') discAmt = (rate * qty) * (item.discountValue || 0) / 100;
      else if (item.discountType === 'fixed') discAmt = Math.min(item.discountValue || 0, rate * qty);
      discountTotal += discAmt;

      const gstRate = transactionWiseTaxEnabled ? (form.gstRate || 0) : (item.gstRate || 0);
      let taxable = Math.max(0, (qty * rate) - discAmt);
      if (inclusiveTax && gstRate > 0) {
        taxable = Math.max(0, taxable / (1 + gstRate / 100));
      }
      taxableAmount += taxable;

      const gstAmt = taxable * gstRate / 100;
      const isInterState = form.isInterState;
      const cgst = !isInterState ? gstAmt / 2 : 0;
      const sgst = !isInterState ? gstAmt / 2 : 0;
      const igst = isInterState ? gstAmt : 0;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      const itemCess = cessEnabled ? (item.cess || 0) : 0;
      cessTotal += itemCess;

      const amount = taxable + gstAmt + itemCess;
      return { ...item, taxableAmount: taxable, discountAmount: discAmt, cgst, sgst, igst, cess: itemCess, amount };
    });

    const addlCharges = (form.shippingCharge || 0) + (form.packingCharge || 0) + (form.freightCharge || 0) + (form.loadingCharge || 0) + (form.otherCharge || 0);
    let totalAmt = taxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal + addlCharges - discOnInvoice;

    let roundOff = 0;
    if (roundOffEnabled || form.roundOffEnabled) {
      const method = form.roundingMethod || roundingMethod || 'Normal';
      const rounded = method === 'Up' ? Math.ceil(totalAmt) : method === 'Down' ? Math.floor(totalAmt) : Math.round(totalAmt);
      roundOff = rounded - totalAmt;
      totalAmt = rounded;
    }

    const totalPaid = paidAmt || payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, totalAmt - totalPaid);
    const pStatus = totalPaid >= totalAmt ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    return { items: calcItems, taxableAmount, discountTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, taxTotal: cgstTotal + sgstTotal + igstTotal + cessTotal, totalAmount: totalAmt, roundOff, paidAmount: totalPaid, remainingBalance: remaining, paymentStatus: pStatus, totalItems, totalQuantity };
  });

  const recalc = useCallback((updates = {}) => {
    setForm(prev => {
      const merged = { ...prev, ...updates };
      const calc = calculate(merged.items, updates.paidAmount !== undefined ? updates.paidAmount : prev.paidAmount, updates.payments || prev.payments, updates.discountOnInvoice !== undefined ? updates.discountOnInvoice : prev.discountOnInvoice);
      return { ...merged, ...calc };
    });
  }, [calculate]);

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (['paidAmount', 'discountOnInvoice', 'shippingCharge', 'packingCharge', 'freightCharge', 'loadingCharge', 'otherCharge'].includes(field)) {
      setTimeout(() => recalc({ [field]: value }), 0);
    }
  };

    const handleCustomerSelect = async (id) => {
    const cust = customers.find(c => c._id === id);
    const custState = cust?.state || '';
    const isInterState = !!(custState && businessState && custState !== businessState);
    setCustomerCreditLimit(cust?.creditLimit || 0);
    setForm(prev => ({
      ...prev, customer: id, customerName: cust?.name || '',
      customerPhone: cust?.phone || '', customerEmail: cust?.email || '',
      customerGst: cust?.gstNumber || '', billingAddress: cust?.address || '',
      customerState: custState, isInterState,
    }));
    // Load party-wise rates
    if (id && getPref('item', 'partyWiseRate')) {
      try {
        const { data } = await partyRateAPI.getByParty(id);
        setPartyRates(data);
        // Apply party rates to existing items
        if (data.length > 0) {
          setForm(prev => ({
            ...prev,
            items: prev.items.map(item => {
              if (!item.product) return item;
              const pr = data.find(r => r.product === item.product);
              if (pr) {
                const rate = pr.rate || 0;
                const discount = pr.discountPercent || 0;
                const discountAmount = (rate * item.quantity * discount) / 100;
                const taxableAmount = rate * item.quantity - discountAmount;
                const gstAmt = taxableAmount * ((item.gstRate || 0) / 100);
                const cgst = isInterState ? 0 : gstAmt / 2;
                const sgst = isInterState ? 0 : gstAmt / 2;
                const igst = isInterState ? gstAmt : 0;
                return { ...item, rate, discountValue: discount, discountType: discount > 0 ? 'percentage' : 'none', discountAmount, taxableAmount, cgst, sgst, igst, amount: taxableAmount + cgst + sgst + igst };
              }
              return item;
            }),
          }));
        }
      } catch { setPartyRates([]); }
    } else {
      setPartyRates([]);
    }
    // Load loyalty points
    if (id && getPref('party', 'enableLoyalty')) {
      try {
        const { data } = await loyaltyAPI.getBalance(id);
        setLoyaltyPointsBalance(data.balance || 0);
      } catch { setLoyaltyPointsBalance(0); }
    } else {
      setLoyaltyPointsBalance(0);
    }
  };

  const handleItemChange = (itemId, field, value) => {
    setForm(prev => {
      const newItems = prev.items.map(item => {
        if (item._id !== itemId) return item;
        const updated = { ...item, [field]: value };
        if (field === 'product') {
          const prod = products.find(p => p._id === value);
          if (prod) {
            updated.productName = prod.name;
            updated.rate = lastSalePriceEnabled ? prod.price : 0;
            updated.gstRate = prod.gstRate || 0;
            updated.hsn = prod.hsn || '';
            updated.unit = prod.unit || 'Pcs';
            updated.mrp = prod.price || 0;
            updated.costPrice = prod.costPrice || 0;
            if (lowStockDialog && stockEnabled && prod.stock <= (prod.minStock || 5) && prod.stock > 0) {
              setTimeout(() => toast.warning(`Low stock: ${prod.name} has only ${prod.stock} units left`), 100);
            }
          }
        }
        return updated;
      });
      const calc = calculate(newItems, prev.paidAmount, prev.payments, prev.discountOnInvoice);
      return { ...prev, ...calc };
    });
  };

  const addItem = () => {
    const countVal = parseInt(getPref('transaction', 'count')) || 1;
    const newItem = emptyItem();
    newItem.quantity = countVal;
    setForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };
  const removeItem = async (itemId) => {
    if (!await requirePasscode('delete this item')) return;
    setForm(prev => {
      if (prev.items.length <= 1) return prev;
      const newItems = prev.items.filter(i => i._id !== itemId);
      const calc = calculate(newItems, prev.paidAmount, prev.payments, prev.discountOnInvoice);
      return { ...prev, ...calc };
    });
  };

  const addPayment = (mode) => {
    setForm(prev => {
      const existingIdx = prev.payments.findIndex(p => p.mode === mode);
      if (existingIdx >= 0) return prev;
      return { ...prev, payments: [...prev.payments, { mode, amount: 0, date: prev.date, transactionNo: '', bankName: '', chequeNo: '', referenceNo: '' }] };
    });
  };

  const updatePayment = (index, field, value) => {
    setForm(prev => {
      const newPayments = [...prev.payments];
      newPayments[index] = { ...newPayments[index], [field]: value };
      const totalPaid = newPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const calc = calculate(prev.items, totalPaid, newPayments, prev.discountOnInvoice);
      return { ...prev, payments: newPayments, ...calc };
    });
  };

  const removePayment = (index) => {
    setForm(prev => {
      const newPayments = prev.payments.filter((_, i) => i !== index);
      const totalPaid = newPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const calc = calculate(prev.items, totalPaid, newPayments, prev.discountOnInvoice);
      return { ...prev, payments: newPayments, ...calc };
    });
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) return toast.error('Customer name is required');
    try {
      const { data } = await customerAPI.create(newCustomer);
      setCustomers(prev => [...prev, data]);
      handleCustomerSelect(data._id);
      setNewCustomer({ name: '', phone: '', email: '', address: '', gstNumber: '', openingBalance: 0 });
      setShowNewCustomer(false);
      toast.success('Customer created');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const filteredProducts = productSearchQuery
    ? products.filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.hsn?.includes(productSearchQuery))
    : [];

  const handleSubmit = async (action = 'save') => {
    if (isEdit && !await requirePasscode('update this document')) return;
    if (form.items.some(i => !i.productName || i.quantity <= 0 || i.rate <= 0)) return toast.error('Please fill all item fields');
    setSubmitting(true);
    try {
      const payload = { ...form };
      payload.items = form.items.map(i => ({ ...i, _id: undefined }));
      payload.type = form.type || 'invoice';
      payload.status = 'confirmed';
      payload.isInterState = !!payload.isInterState;
      if (!payload.customerType) delete payload.customerType;

      if (form.isRecurring) {
        payload.isRecurring = form.isRecurring;
        payload.isRecurringTemplate = true;
        payload.recurringFrequency = form.recurringFrequency;
        payload.recurringNextDate = form.recurringNextDate || form.date;
        payload.recurringEndDate = form.recurringEndDate || undefined;
        payload.recurringMaxCount = form.recurringMaxCount || 0;
      }

      if (isEdit) {
        await saleAPI.update(id, payload);
        toast.success('Invoice updated');
        navigate('/sales');
      } else {
        const res = await saleAPI.create(payload);
        const newId = res?.data?._id;
        toast.success('Invoice created');
        if (skipPreview || !newId) navigate('/sales');
        else if (action === 'save') navigate(`/sales/${newId}`);
        else if (action === 'save_new') navigate(0);
        else if (action === 'save_print') navigate(`/sales/${newId}`);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1400px] mx-auto px-2">
      {/* Top Tabs Bar */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-b-0 border-slate-200 text-sm font-semibold text-slate-900 rounded-t-lg whitespace-nowrap shadow-sm">
          <Receipt className="w-4 h-4 text-blue-600" />
          {isEdit ? 'Edit' : 'New'} {form.invoiceNumber ? `#${form.invoiceNumber}` : 'Document'}
          <button onClick={() => navigate('/sales')} className="ml-1 text-slate-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
        <button onClick={() => navigate('/sales/new')} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors bg-white shadow-sm"><Plus className="w-4 h-4" /></button>
      </div>

      {/* Title Row */}
      <div className="flex items-center gap-6 mb-4 px-1 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900 capitalize tracking-tight">{form.type === 'credit_note' ? 'Credit Note' : form.type === 'challan' ? 'Delivery Challan' : form.type === 'order' ? 'Sale Order' : form.type === 'proforma' ? 'Proforma Invoice' : form.type === 'estimate' ? 'Estimate' : form.type === 'quotation' ? 'Quotation' : 'Sale'}</h1>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full text-sm">
          <button onClick={() => {
            setCashMode(false);
            setForm(prev => ({ ...prev, payments: [], paidAmount: 0, remainingBalance: prev.totalAmount || 0, paymentStatus: 'unpaid' }));
            toast.success('Marked as Credit');
          }} className={`px-4 py-1.5 rounded-full transition-all font-medium ${!cashMode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Credit</button>
          <button onClick={() => {
            if (cashMode) {
              setCashMode(false);
              setForm(prev => ({ ...prev, payments: [], paidAmount: 0, remainingBalance: prev.totalAmount || 0, paymentStatus: 'unpaid' }));
              toast.success('Marked as Credit');
            } else {
              setCashMode(true);
              const total = form.totalAmount || 0;
              setForm(prev => ({ ...prev, payments: [{ mode: 'cash', amount: total, date: new Date().toISOString().split('T')[0], transactionNo: '', bankName: '', chequeNo: '', referenceNo: '' }], paidAmount: total, remainingBalance: 0, paymentStatus: 'paid' }));
              toast.success('Marked as Cash');
            }
          }} className={`relative w-11 h-6 rounded-full transition-colors ${cashMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cashMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <button onClick={() => {
            setCashMode(true);
            const total = form.totalAmount || 0;
            setForm(prev => ({ ...prev, payments: [{ mode: 'cash', amount: total, date: new Date().toISOString().split('T')[0], transactionNo: '', bankName: '', chequeNo: '', referenceNo: '' }], paidAmount: total, remainingBalance: 0, paymentStatus: 'paid' }));
            toast.success('Marked as Cash');
          }} className={`px-4 py-1.5 rounded-full transition-all font-medium ${cashMode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cash</button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-slate-400" />
          <select value={form.type} onChange={(e) => handleFieldChange('type', e.target.value)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 capitalize transition-colors">
            <option value="invoice">Invoice</option>
            <option value="estimate">Estimate</option>
            <option value="quotation">Quotation</option>
            <option value="proforma">Proforma Invoice</option>
            <option value="order">Sale Order</option>
            <option value="challan">Delivery Challan</option>
            <option value="credit_note">Credit Note</option>
          </select>
        </div>
      </div>

      {/* Top Customer/Invoice Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Customer <span className="text-red-500">*</span></label>
            <select value={form.customer} onChange={(e) => handleCustomerSelect(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
              <option value="">Search by Name/Phone</option>
              {customers.map(c => <option key={c._id} value={c._id}>{billingNamePref === 'Trading' ? (c.tradeName || c.name) : c.name}{c.phone ? ` (${c.phone})` : ''}{managePartyStatus && c.status === 'inactive' ? ' (Inactive)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone No.</label>
            <input value={form.customerPhone} onChange={(e) => handleFieldChange('customerPhone', e.target.value)} placeholder="Phone No." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Invoice Number <span className="text-red-500">*</span>{invoiceNoMode === 'Manual' && <span className="text-xs text-amber-600 ml-2">(Manual Entry)</span>}</label>
            <input value={form.invoiceNumber} onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)} readOnly={invoiceNoMode !== 'Manual' && isEdit} placeholder={invoiceNoMode === 'Manual' ? 'Enter invoice number' : ''} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Invoice Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.date} onChange={(e) => handleFieldChange('date', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
          </div>
          {godownEnabled && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Warehouse</label>
            <select value={form.warehouse || ''} onChange={(e) => handleFieldChange('warehouse', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
              <option value="">Main Warehouse</option>
            </select>
          </div>
          )}
          {placeOfSupplyEnabled && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State of Supply</label>
            <select value={form.customerState} onChange={(e) => {
              handleFieldChange('customerState', e.target.value);
              const isInter = !!(e.target.value && businessState && e.target.value !== businessState);
              handleFieldChange('isInterState', isInter);
            }} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          )}
          {reverseChargeEnabled && (
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={form.reverseCharge || false} onChange={(e) => handleFieldChange('reverseCharge', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label className="text-xs text-slate-600">Reverse Charge Applicable</label>
          </div>
          )}
          {shippingAddrEnabled && (
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Shipping Address</label>
            <textarea value={form.shippingAddress || ''} onChange={(e) => handleFieldChange('shippingAddress', e.target.value)} placeholder="Enter shipping address (if different from billing)" rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none" />
          </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-500" /> Items
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-200 rounded-full">{form.items.length}</span>
            {quickEntryEnabled && <span className="px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-100 rounded-full">Quick Entry</span>}
          </h3>
          <div className="flex items-center gap-3">
            {transactionWiseTaxEnabled && (
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-slate-500">Tax:</label>
                <select value={form.gstRate || 0} onChange={e => { setForm(f => ({ ...f, gstRate: parseFloat(e.target.value) })); setTimeout(() => recalc(), 0); }}
                  className="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            )}
            <span className="text-xs text-slate-500">{form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)} units total</span>
          </div>
        </div>
        {quickEntryEnabled ? (
          /* Quick Entry Mode */
          <div className="p-4 space-y-2">
            {form.items.map((item, idx) => (
              <div key={item._id} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-6 text-center">{idx + 1}</span>
                <select value={item.product} onChange={(e) => handleItemChange(item._id, 'product', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Select Item</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <input type="number" min="0.001" step="0.001" value={item.quantity}
                  onChange={(e) => handleItemChange(item._id, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="Qty" className="w-20 px-2 py-1.5 text-sm text-right border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input type="number" step="0.01" min="0" value={item.rate}
                  onChange={(e) => handleItemChange(item._id, 'rate', parseFloat(e.target.value) || 0)}
                  placeholder="Rate" className="w-24 px-2 py-1.5 text-sm text-right border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="w-24 text-right text-sm font-semibold text-slate-900 tabular-nums">{fmt(item.amount || 0)}</span>
                {form.items.length > 1 && <button onClick={() => removeItem(item._id)} className="p-1 text-slate-300 hover:text-red-500 rounded"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            <button onClick={addItem} className="text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded inline-flex items-center gap-1 mt-2">
              <Plus className="w-4 h-4" /> Add Row
            </button>
          </div>
        ) : (
          /* Normal Entry Mode */
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/30">
                <th className="px-3 py-3 text-center w-10">#</th>
                <th className="px-3 py-3 text-left min-w-[200px]">Item <span className="text-red-500">*</span></th>
                <th className="px-3 py-3 text-center w-20">Qty <span className="text-red-500">*</span></th>
                <th className="px-3 py-3 text-center w-16">Unit</th>
                <th className="px-3 py-3 text-right w-28">Price/Unit <span className="text-red-500">*</span></th>
                <th className="px-3 py-3 text-center w-24">Discount</th>
                <th className="px-3 py-3 text-center w-20">Tax</th>
                <th className="px-3 py-3 text-right w-28">Amount</th>
                {showProfit && <th className="px-3 py-3 text-right w-24">Profit</th>}
                {stockEnabled && <th className="px-3 py-3 text-right w-20">Stock</th>}
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={item._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2.5 text-center text-slate-400 text-xs font-medium">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <select value={item.product} onChange={(e) => handleItemChange(item._id, 'product', e.target.value)} className="w-full px-2 py-1.5 text-sm border-b border-slate-200 bg-transparent hover:border-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
                      <option value="">Select Item</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => handleItemChange(item._id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 bg-transparent hover:border-slate-300 focus:outline-none focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-slate-500 font-medium">{item.unit || 'Pcs'}</td>
                  <td className="px-3 py-2.5">
                    <input type="number" step="0.01" min="0" value={item.rate} onChange={(e) => handleItemChange(item._id, 'rate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm text-right border-b border-slate-200 bg-transparent hover:border-slate-300 focus:outline-none focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" min="0" max="100" value={item.discountValue || 0} onChange={(e) => handleItemChange(item._id, 'discountValue', parseFloat(e.target.value) || 0)} className="w-12 px-2 py-1.5 text-xs text-right border-b border-slate-200 bg-transparent hover:border-slate-300 focus:outline-none focus:border-blue-500 transition-colors" />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select value={item.gstRate} onChange={(e) => handleItemChange(item._id, 'gstRate', parseFloat(e.target.value))} className="w-full px-2 py-1.5 text-xs text-right border-b border-slate-200 bg-transparent hover:border-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900 tabular-nums">{fmt(item.amount || 0)}</td>
                  {showProfit && (
                    <td className="px-3 py-2.5 text-right text-xs">
                      {item.costPrice > 0 ? (
                        <span className={item.amount - item.costPrice * item.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {fmt(item.amount - item.costPrice * item.quantity)}
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                  )}
                  {stockEnabled && (
                    <td className="px-3 py-2.5 text-right text-xs text-slate-500">
                      {(() => { const p = products.find(pr => pr._id === item.product); return p ? <span className={p.stock <= (p.minStock || 0) ? 'text-red-600 font-medium' : ''}>{p.stock ?? 0}</span> : '-'; })()}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    {form.items.length > 1 && <button onClick={() => removeItem(item._id)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                <td colSpan={(showProfit ? 8 : 7) + (stockEnabled ? 1 : 0)} className="px-3 py-3">
                  <button onClick={addItem} disabled={blockNewItems} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /> Add Row</button>
                </td>
                <td className="px-3 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{fmt(form.totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}
      </div>

      {/* Additional Charges, Transport, Due Date */}
      {(additionalChargesEnabled || transportEnabled || dueDatesEnabled) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-3 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {additionalChargesEnabled && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Shipping Charge</label>
                  <input type="number" step="0.01" min="0" value={form.shippingCharge || 0} onChange={(e) => handleFieldChange('shippingCharge', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Packing Charge</label>
                  <input type="number" step="0.01" min="0" value={form.packingCharge || 0} onChange={(e) => handleFieldChange('packingCharge', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Freight Charge</label>
                  <input type="number" step="0.01" min="0" value={form.freightCharge || 0} onChange={(e) => handleFieldChange('freightCharge', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Loading Charge</label>
                  <input type="number" step="0.01" min="0" value={form.loadingCharge || 0} onChange={(e) => handleFieldChange('loadingCharge', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Other Charge</label>
                  <input type="number" step="0.01" min="0" value={form.otherCharge || 0} onChange={(e) => handleFieldChange('otherCharge', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
              </>
            )}
            {transportEnabled && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Transport Mode</label>
                  <input value={form.transportMode || ''} onChange={(e) => handleFieldChange('transportMode', e.target.value)} placeholder="e.g. Road, Rail" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Vehicle Number</label>
                  <input value={form.vehicleNo || ''} onChange={(e) => handleFieldChange('vehicleNo', e.target.value)} placeholder="Vehicle No." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                </div>
              </>
            )}
            {dueDatesEnabled && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate || ''} onChange={(e) => handleFieldChange('dueDate', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Row: Add buttons + Totals */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-3 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Add buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setOpenModal('terms')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.termsConditions ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-blue-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
              {form.termsConditions ? '✓ Terms Added' : '+ Terms & Conditions'}
            </button>
            <button onClick={() => setOpenModal('description')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.notes ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-blue-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
              {form.notes ? '✓ Description Added' : '+ Description'}
            </button>
            <button onClick={() => setOpenModal('image')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${imageFile ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-blue-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
              {imageFile ? `✓ ${imageFile.name.slice(0, 12)}...` : '+ Add Image'}
            </button>
            <button onClick={() => setOpenModal('document')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${docFile ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-blue-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
              {docFile ? `✓ ${docFile.name.slice(0, 12)}...` : '+ Add Document'}
            </button>
            <button onClick={() => setOpenModal('recurring')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${form.isRecurring ? 'text-emerald-700 border border-emerald-200 bg-emerald-50' : 'text-blue-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
              {form.isRecurring ? '✓ Recurring' : '+ Make Recurring'}
            </button>
          </div>
          {/* Right: Totals */}
          <div className="space-y-2 lg:max-w-sm lg:ml-auto lg:w-full">
            <div className="flex justify-between text-sm py-1"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900 tabular-nums">{fmt(form.taxableAmount || 0)}</span></div>
            {form.discountTotal > 0 && <div className="flex justify-between text-sm py-1"><span className="text-slate-500">Discount</span><span className="font-medium text-rose-500 tabular-nums">−{fmt(form.discountTotal)}</span></div>}
            {gstEnabled && form.cgstTotal > 0 && <div className="flex justify-between text-sm py-1"><span className="text-slate-500">CGST</span><span className="font-medium text-slate-900 tabular-nums">{fmt(form.cgstTotal)}</span></div>}
            {gstEnabled && form.sgstTotal > 0 && <div className="flex justify-between text-sm py-1"><span className="text-slate-500">SGST</span><span className="font-medium text-slate-900 tabular-nums">{fmt(form.sgstTotal)}</span></div>}
            {form.isInterState && form.igstTotal > 0 && <div className="flex justify-between text-sm py-1"><span className="text-slate-500">IGST</span><span className="font-medium text-slate-900 tabular-nums">{fmt(form.igstTotal)}</span></div>}
            {transactionWiseDiscountEnabled && (
              <div className="flex items-center justify-between text-sm gap-2 py-1.5">
                <span className="text-slate-500">Invoice Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">₹</span>
                  <input type="number" step="0.01" min="0" value={form.discountOnInvoice || 0}
                    onChange={(e) => handleFieldChange('discountOnInvoice', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-sm text-right border-b border-slate-300 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
            )}
            {form.discountOnInvoice > 0 && <div className="flex justify-between text-sm py-1"><span className="text-slate-500">Invoice Discount</span><span className="font-medium text-rose-500 tabular-nums">−{fmt(form.discountOnInvoice)}</span></div>}
            <div className="flex items-center justify-between text-sm gap-2 py-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.roundOffEnabled || false} onChange={(e) => {
                  handleFieldChange('roundOffEnabled', e.target.checked);
                  if (!e.target.checked) handleFieldChange('roundOff', 0);
                }} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-slate-600">Round Off</span>
              </label>
              <input type="number" step="0.01" value={form.roundOff || 0} onChange={(e) => handleFieldChange('roundOff', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1 text-sm text-right border-b border-slate-300 bg-transparent hover:border-slate-400 focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div className="flex justify-between items-center text-base font-bold py-2 border-t-2 border-slate-300">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900 tabular-nums text-lg">{fmt(form.totalAmount)}</span>
            </div>
            {customerCreditLimit > 0 && form.remainingBalance > customerCreditLimit && (
              <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1.5 rounded-lg">
                <AlertTriangle className="w-3 h-3" /> Credit limit of {fmt(customerCreditLimit)} exceeded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recurring Invoice */}
      {docType === 'invoice' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Recurring Invoice
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(prev => ({ ...prev, isRecurring: e.target.checked }))} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          {form.isRecurring && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Frequency</label>
                <select value={form.recurringFrequency} onChange={e => setForm(prev => ({ ...prev, recurringFrequency: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
                <input type="date" value={form.recurringNextDate || form.date} onChange={e => setForm(prev => ({ ...prev, recurringNextDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">End Date (Optional)</label>
                <input type="date" value={form.recurringEndDate} onChange={e => setForm(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Count (0 = unlimited)</label>
                <input type="number" min="0" value={form.recurringMaxCount} onChange={e => setForm(prev => ({ ...prev, recurringMaxCount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Additional Fields */}
      {additionalFieldsEnabled && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-3 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reference 1</label>
              <input value={form.additionalField1 || ''} onChange={(e) => handleFieldChange('additionalField1', e.target.value)}
                placeholder="Custom field 1" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reference 2</label>
              <input value={form.additionalField2 || ''} onChange={(e) => handleFieldChange('additionalField2', e.target.value)}
                placeholder="Custom field 2" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mb-4">
        <button disabled className="px-4 py-2.5 text-sm font-medium text-slate-400 border border-slate-200 rounded-lg cursor-not-allowed flex items-center gap-2 bg-white">
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button onClick={() => navigate('/sales')} className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors bg-white">
          Cancel
        </button>
        <button onClick={() => handleSubmit('save')} disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Modals for Terms/Description/Image/Document */}
      <AnimatePresence>
        {openModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpenModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {openModal === 'terms' && 'Terms and Conditions'}
                  {openModal === 'description' && 'Description / Notes'}
                  {openModal === 'image' && 'Add Image'}
                  {openModal === 'document' && 'Add Document'}
                </h3>
                <button onClick={() => setOpenModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              {openModal === 'terms' && (
                <div>
                  <textarea value={form.termsConditions} onChange={(e) => handleFieldChange('termsConditions', e.target.value)} rows={6} placeholder="Enter your terms and conditions..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => { handleFieldChange('termsConditions', ''); }} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">Clear</button>
                    <button onClick={() => setOpenModal(null)} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">Done</button>
                  </div>
                </div>
              )}
              {openModal === 'description' && (
                <div>
                  <textarea value={form.notes} onChange={(e) => handleFieldChange('notes', e.target.value)} rows={6} placeholder="Add description or customer notes..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => { handleFieldChange('notes', ''); }} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">Clear</button>
                    <button onClick={() => setOpenModal(null)} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">Done</button>
                  </div>
                </div>
              )}
              {openModal === 'image' && (
                <div>
                  <label className="block w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500">
                    <input type="file" accept="image/*" onChange={(e) => { setImageFile(e.target.files[0]); setOpenModal(null); }} className="hidden" />
                    <Plus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Click to upload an image</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF up to 5MB</p>
                  </label>
                  {imageFile && (
                    <div className="mt-3 flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-xs text-slate-700 truncate">{imageFile.name}</span>
                      <button onClick={() => setImageFile(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                </div>
              )}
              {openModal === 'document' && (
                <div>
                  <label className="block w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500">
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { setDocFile(e.target.files[0]); setOpenModal(null); }} className="hidden" />
                    <Plus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Click to upload a document</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOC, XLS up to 10MB</p>
                  </label>
                  {docFile && (
                    <div className="mt-3 flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-xs text-slate-700 truncate">{docFile.name}</span>
                      <button onClick={() => setDocFile(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  )}
                </div>
              )}
              {openModal === 'recurring' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Recurring Invoice</p>
                      <p className="text-xs text-slate-500">Automatically create invoices on a schedule</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Enable Recurring</label>
                    <button onClick={() => handleFieldChange('isRecurring', !form.isRecurring)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.isRecurring ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {form.isRecurring && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Frequency</label>
                        <select value={form.recurringFrequency} onChange={(e) => handleFieldChange('recurringFrequency', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
                          <input type="date" value={form.recurringNextDate || form.date} onChange={(e) => handleFieldChange('recurringNextDate', e.target.value)}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date (Optional)</label>
                          <input type="date" value={form.recurringEndDate} onChange={(e) => handleFieldChange('recurringEndDate', e.target.value)}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Max Count (0 = Unlimited)</label>
                        <input type="number" min="0" value={form.recurringMaxCount || 0} onChange={(e) => handleFieldChange('recurringMaxCount', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="0 for unlimited" />
                      </div>
                    </>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setOpenModal(null)} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Done</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const w = (n) => {
    if (n < 20) return a[n]; if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''); if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + w(n % 100) : '');
    if (n < 100000) return w(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + w(n % 1000) : ''); if (n < 10000000) return w(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + w(n % 100000) : '');
    return w(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + w(n % 10000000) : '');
  };
  return w(Math.floor(num)) + ' Rupees Only';
};

export default CreateSale;
