import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Sparkles, FileText, Hash, Calendar, User, Phone, Mail, MapPin,
  Plus, Trash2, Package, BadgePercent, IndianRupee, Save, Download, Share2,
  MessageSquare, Send, AlertCircle, CheckCircle, Clock, Search, Loader2,
  CreditCard, Building2, Wallet, Landmark, Zap, HelpCircle, X, Printer
} from 'lucide-react';
import { saleAPI, customerAPI, productAPI, settingAPI } from '../services/api';
import { formatCurrency, formatDate, numberToWords } from '../utils/format';
import useSettings from '../hooks/useSettings';
import CustomerSearch from '../components/Invoice/CustomerSearch';
import ProductRow from '../components/Invoice/ProductRow';
import InvoicePreview from '../components/Invoice/InvoicePreview';

const DEFAULT_gstRates = [0, 3, 5, 12, 18, 28];
const paymentMethods = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'upi', label: 'UPI', icon: Zap },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'bank', label: 'Bank Transfer', icon: Landmark },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const emptyItem = { product: '', productName: '', quantity: 1, rate: 0, amount: 0, gstRate: 0, taxableAmount: 0, cgst: 0, sgst: 0, discount: 0 };

const QuickInvoice = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const savedTaxRates = settings?.preferences?.taxes?.taxRates;
  const gstRates = savedTaxRates?.length ? savedTaxRates.map(r => r.igst) : DEFAULT_gstRates;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [form, setForm] = useState({
    invoiceNumber: '',
    customer: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentTerms: 'net15',
    items: [{ ...emptyItem }],
    paidAmount: 0,
    paymentMethod: 'cash',
    notes: '',
  });

  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, custRes, prodRes, setRes] = await Promise.all([
          saleAPI.getNextInvoice(),
          customerAPI.getAll(),
          productAPI.getAll(),
          settingAPI.get().catch(() => null),
        ]);
        setForm(f => ({ ...f, invoiceNumber: invRes.data.invoiceNumber }));
        setCustomers(custRes.data);
        setProducts(prodRes.data);
        setSettings(setRes?.data || null);
      } catch (err) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Computed values
  const taxableAmount = form.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
  const cgstTotal = form.items.reduce((s, i) => {
    const taxable = i.quantity * i.rate;
    return s + (taxable * (i.gstRate / 100) / 2);
  }, 0);
  const sgstTotal = form.items.reduce((s, i) => {
    const taxable = i.quantity * i.rate;
    return s + (taxable * (i.gstRate / 100) / 2);
  }, 0);
  const totalGst = cgstTotal + sgstTotal;
  const totalDiscount = form.items.reduce((s, i) => s + (i.discount || 0), 0);
  const grandTotal = taxableAmount + totalGst - totalDiscount;
  const remainingBalance = grandTotal - form.paidAmount;

  const calcItem = (item) => {
    const taxable = item.quantity * item.rate;
    const gstHalf = taxable * (item.gstRate / 100) / 2;
    return { ...item, taxableAmount: taxable, cgst: gstHalf, sgst: gstHalf, amount: taxable + gstHalf + gstHalf };
  };

  const handleFormChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleCustomerSelect = (id) => {
    const cust = customers.find(c => c._id === id);
    setForm(f => ({
      ...f,
      customer: id,
      customerName: cust ? cust.name : '',
      customerPhone: cust ? cust.phone : '',
      customerEmail: cust ? cust.email : '',
      customerAddress: cust ? cust.address : '',
    }));
  };

  const handleItemChange = (index, updates) => {
    const newItems = [...form.items];
    const item = { ...newItems[index], ...updates };

    if (updates.product !== undefined) {
      const prod = products.find(p => p._id === updates.product);
      if (prod) {
        item.productName = prod.name;
        if (updates.rate === undefined) item.rate = prod.price;
        if (updates.gstRate === undefined) item.gstRate = prod.gstRate || 0;
      }
    }

    newItems[index] = calcItem(item);
    setForm(f => ({ ...f, items: newItems }));
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  };

  const removeItem = (index) => {
    if (form.items.length > 1) {
      setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) return toast.error('Customer name is required');
    try {
      const { data } = await customerAPI.create(newCustomer);
      setCustomers(prev => [...prev, data]);
      handleCustomerSelect(data._id);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setShowNewCustomer(false);
      toast.success('Customer created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    }
  };

  const handleSaveDraft = async () => {
    if (form.items.some(i => !i.productName || i.quantity <= 0 || i.rate <= 0)) {
      return toast.error('Please fill all item fields');
    }
    setSubmitting(true);
    try {
      await saleAPI.create({
        invoiceNumber: form.invoiceNumber,
        type: 'invoice',
        status: 'confirmed',
        customer: form.customer || null,
        customerName: form.customerName,
        customerPhone: form.customerPhone || '',
        customerEmail: form.customerEmail || '',
        customerGst: form.customerGst || '',
        customerState: form.customerState || '',
        date: form.date,
        dueDate: form.dueDate,
        isInterState: false,
        items: form.items.map(i => ({
          ...i,
          amount: i.quantity * i.rate,
          taxableAmount: i.quantity * i.rate,
          gstRate: i.gstRate || 0,
          cgst: i.gstRate ? (i.quantity * i.rate * i.gstRate / 200) : 0,
          sgst: i.gstRate ? (i.quantity * i.rate * i.gstRate / 200) : 0,
          igst: 0,
        })),
        taxableAmount,
        cgstTotal,
        sgstTotal,
        igstTotal: 0,
        cessTotal: 0,
        taxTotal: cgstTotal + sgstTotal,
        discountTotal: 0,
        shippingCharge: 0,
        packingCharge: 0,
        additionalChargesTotal: 0,
        totalAmount: grandTotal,
        paidAmount: form.paidAmount,
        remainingBalance,
        payments: form.paidAmount > 0 ? [{ mode: form.paymentMethod || 'cash', amount: form.paidAmount, date: form.date }] : [],
        paymentMethod: form.paidAmount > 0 ? form.paymentMethod : undefined,
        paymentStatus: form.paidAmount >= grandTotal ? 'paid' : form.paidAmount > 0 ? 'partial' : 'unpaid',
        notes: form.notes,
        termsConditions: '',
        reverseCharge: false,
      });
      toast.success('Draft saved');
      navigate('/sales');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (form.items.some(i => !i.productName || i.quantity <= 0 || i.rate <= 0)) {
      return toast.error('Please fill all item fields');
    }
    if (!form.customerName) return toast.error('Please select a customer');
    setSubmitting(true);
    try {
      await saleAPI.create({
        invoiceNumber: form.invoiceNumber,
        type: 'invoice',
        status: 'confirmed',
        customer: form.customer || null,
        customerName: form.customerName,
        customerPhone: form.customerPhone || '',
        customerEmail: form.customerEmail || '',
        customerGst: form.customerGst || '',
        customerState: form.customerState || '',
        date: form.date,
        dueDate: form.dueDate,
        isInterState: false,
        items: form.items.map(i => ({
          ...i,
          amount: i.quantity * i.rate,
          taxableAmount: i.quantity * i.rate,
          gstRate: i.gstRate || 0,
          cgst: i.gstRate ? (i.quantity * i.rate * i.gstRate / 200) : 0,
          sgst: i.gstRate ? (i.quantity * i.rate * i.gstRate / 200) : 0,
          igst: 0,
        })),
        taxableAmount,
        cgstTotal,
        sgstTotal,
        igstTotal: 0,
        cessTotal: 0,
        taxTotal: cgstTotal + sgstTotal,
        discountTotal: 0,
        shippingCharge: 0,
        packingCharge: 0,
        additionalChargesTotal: 0,
        totalAmount: grandTotal,
        paidAmount: form.paidAmount,
        remainingBalance,
        payments: form.paidAmount > 0 ? [{ mode: form.paymentMethod || 'cash', amount: form.paidAmount, date: form.date }] : [],
        paymentMethod: form.paidAmount > 0 ? form.paymentMethod : undefined,
        paymentStatus: form.paidAmount >= grandTotal ? 'paid' : form.paidAmount > 0 ? 'partial' : 'unpaid',
        notes: form.notes,
        termsConditions: '',
        reverseCharge: false,
      });
      toast.success('Invoice generated successfully!');
      navigate('/sales');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-400">Loading invoice creator...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-[1440px] mx-auto">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Back to Sales"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Quick Invoice</h1>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold rounded-md border border-blue-100 dark:border-blue-800/30 flex items-center gap-1">
                <Zap className="w-3 h-3" /> 30s Creation
              </span>
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Generate invoices quickly and track payments instantly.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded text-[10px] font-mono">⌘</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded text-[10px] font-mono">S</kbd> Save</span>
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT PANEL - Form */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* SECTION 1: Invoice Details */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invoice Details</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Invoice Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={form.invoiceNumber}
                      readOnly
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-slate-50 dark:bg-gray-700 text-slate-700 dark:text-slate-300 text-sm font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Invoice Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => handleFormChange('date', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Due Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => handleFormChange('dueDate', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Terms</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => handleFormChange('paymentTerms', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="net15">Net 15</option>
                    <option value="net30">Net 30</option>
                    <option value="net45">Net 45</option>
                    <option value="due-on-receipt">Due on Receipt</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 2: Customer Details */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10">
                  <User className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Customer Details</h3>
              </div>
              <button
                onClick={() => setShowNewCustomer(!showNewCustomer)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> New Customer
              </button>
            </div>
            <div className="p-5">
              <AnimatePresence>
                {showNewCustomer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="bg-violet-50/50 dark:bg-violet-500/5 rounded-xl p-4 border border-violet-100 dark:border-violet-800/30 space-y-3">
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">New Customer</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                          placeholder="Customer Name *"
                          className="px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <input
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                          placeholder="Phone Number"
                          className="px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <input
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                          placeholder="Email Address"
                          className="px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <input
                          value={newCustomer.address}
                          onChange={(e) => setNewCustomer(p => ({ ...p, address: e.target.value }))}
                          placeholder="Billing Address"
                          className="px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowNewCustomer(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateCustomer}
                          className="px-4 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                        >
                          Create Customer
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomerSearch
                  customers={customers}
                  value={form.customer}
                  onChange={handleCustomerSelect}
                  onCreateNew={() => setShowNewCustomer(true)}
                />
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Or Enter Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={form.customerName}
                      onChange={(e) => handleFormChange('customerName', e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={form.customerPhone}
                      onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={form.customerEmail}
                      onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Billing Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={form.customerAddress}
                      onChange={(e) => handleFormChange('customerAddress', e.target.value)}
                      placeholder="Enter billing address..."
                      rows={2}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 3: Products */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Products</h3>
              </div>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            {form.items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No items added yet</p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Click "Add Item" to start building your invoice</p>
                <button onClick={addItem} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  <Plus className="w-4 h-4" /> Add First Item
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
                      <th className="px-3 py-3.5 text-left text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[200px]">Product</th>
                      <th className="px-3 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-20">Qty</th>
                      <th className="px-3 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-24">Unit Price</th>
                      <th className="px-3 py-3.5 text-center text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-16">GST %</th>
                      <th className="px-3 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-20">Discount</th>
                      <th className="px-3 py-3.5 text-right text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-24">Amount</th>
                      <th className="px-3 py-3.5 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                    {form.items.map((item, idx) => (
                      <ProductRow
                        key={idx}
                        item={item}
                        index={idx}
                        products={products}
                        onChange={handleItemChange}
                        onRemove={removeItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {form.items.filter(i => i.productName).length} item{form.items.filter(i => i.productName).length !== 1 ? 's' : ''} added
              </p>
              {form.items.length > 0 && (
                <button onClick={addItem} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                  <Plus className="w-3 h-3" /> Add Another Item
                </button>
              )}
            </div>
          </motion.div>

          {/* SECTION 4: Payment Summary */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <IndianRupee className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payment Summary</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-gray-700/50">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Subtotal</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(taxableAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-gray-700/50">
                    <span className="text-sm text-slate-500 dark:text-slate-400">CGST</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatCurrency(cgstTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-gray-700/50">
                    <span className="text-sm text-slate-500 dark:text-slate-400">SGST</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatCurrency(sgstTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-gray-700/50">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Total GST</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatCurrency(totalGst)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-gray-700/50">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Total Discount</span>
                      <span className="text-sm font-medium text-red-500">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">Grand Total</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment Received */}
                <div className="bg-slate-50/50 dark:bg-gray-700/30 rounded-xl p-4 border border-slate-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Payment Received
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Received Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.paidAmount}
                        onChange={(e) => handleFormChange('paidAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-slate-200/80 dark:border-gray-700/80 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {paymentMethods.map((pm) => (
                          <button
                            key={pm.value}
                            onClick={() => handleFormChange('paymentMethod', pm.value)}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              form.paymentMethod === pm.value
                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                : 'bg-white dark:bg-gray-700 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-gray-700/80 hover:border-blue-200'
                            }`}
                          >
                            <pm.icon className="w-3 h-3" />
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Balance Status */}
                    <div className={`p-3 rounded-xl border text-sm ${
                      grandTotal === 0 ? 'bg-slate-50 border-slate-200' :
                      form.paidAmount >= grandTotal
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-800/30'
                        : form.paidAmount > 0
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-800/30'
                        : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-800/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {grandTotal === 0 ? (
                            <Clock className="w-4 h-4 text-slate-400" />
                          ) : form.paidAmount >= grandTotal ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : form.paidAmount > 0 ? (
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`text-xs font-semibold ${
                            grandTotal === 0 ? 'text-slate-400' :
                            form.paidAmount >= grandTotal ? 'text-emerald-700 dark:text-emerald-300' :
                            form.paidAmount > 0 ? 'text-amber-700 dark:text-amber-300' :
                            'text-red-700 dark:text-red-300'
                          }`}>
                            {grandTotal === 0 ? 'No items' :
                             form.paidAmount >= grandTotal ? 'PAID' :
                             form.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${
                          grandTotal === 0 ? 'text-slate-400' :
                          form.paidAmount >= grandTotal ? 'text-emerald-700 dark:text-emerald-300' :
                          form.paidAmount > 0 ? 'text-amber-700 dark:text-amber-300' :
                          'text-red-700 dark:text-red-300'
                        }`}>
                          {formatCurrency(remainingBalance)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {grandTotal === 0 ? 'Add items to calculate' :
                         form.paidAmount >= grandTotal ? 'Full payment received' :
                         form.paidAmount > 0 ? `Balance due: ${formatCurrency(remainingBalance)}` :
                         `Awaiting payment of ${formatCurrency(grandTotal)}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 5: Notes */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-gray-700">
                <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notes & Terms</h3>
            </div>
            <div className="p-5">
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Add any notes or payment terms for the customer..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-200/80 dark:border-gray-700/80 rounded-xl bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>
          </motion.div>

          {/* SECTION 6: Action Buttons */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Generating...' : 'Generate Invoice'}
              </button>
              <button className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-800/30">
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </motion.div>

        </div>

        {/* RIGHT PANEL - Invoice Preview */}
        <div className="lg:w-[380px] xl:w-[420px] flex-shrink-0">
          <InvoicePreview
            form={form}
            settings={settings}
          />
        </div>
      </div>
    </motion.div>
  );
};

const XCircle = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export default QuickInvoice;
