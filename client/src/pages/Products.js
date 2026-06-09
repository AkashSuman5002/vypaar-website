import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { godownAPI } from '../services/api';
import { formatCurrency } from '../utils/format';
import useSettings from '../hooks/useSettings';
import {
  Package, Plus, Download, Upload, Search, SlidersHorizontal,
  Pencil, Trash2, Eye, Copy, X, ChevronDown, ChevronLeft, ChevronRight,
  Image as ImageIcon, IndianRupee, AlertTriangle, BarChart3, Box, Tag,
  Hash, FileText, ShoppingCart, Truck, Warehouse, MapPin, Percent,
  Barcode, QrCode, RefreshCw, CheckCircle, Star, Grid3X3, List,
  Layers, Shield, PackageCheck, ClipboardList, GripVertical,
  Settings2, Camera, HelpCircle,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const CATEGORIES = ['Electronics', 'Fashion', 'Groceries', 'Furniture', 'Stationery', 'Services', 'Other'];
const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair', 'set', 'pack'];
const GST_RATES = [0, 5, 12, 18, 28];
const STOCK_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];
const TYPE_FILTERS = ['All Items', 'Products', 'Services'];



const StockHealthBar = ({ stock, minStock }) => {
  const ratio = minStock > 0 ? stock / minStock : 1;
  const isHealthy = stock >= minStock;
  const isLow = stock > 0 && stock < minStock;
  const isCritical = stock === 0;
  const color = isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500';
  const bgColor = isCritical ? 'bg-red-100 dark:bg-red-500/20' : isLow ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-emerald-100 dark:bg-emerald-500/20';
  const label = isCritical ? 'Critical' : isLow ? 'Low' : 'Healthy';
  const textColor = isCritical ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  const width = Math.min(Math.max(ratio * 100, 5), 100);
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex-1 h-2 rounded-full ${bgColor} overflow-hidden`}>
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-[10px] font-semibold ${textColor} whitespace-nowrap`}>{label}</span>
    </div>
  );
};

const Badge = ({ variant, children }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    low: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    healthy: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    product: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    service: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${styles[variant] || styles.default}`}>
      {children}
    </span>
  );
};

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All Items');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailProductId, setDetailProductId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [images, setImages] = useState([]);
  const pageSize = 10;
  const { getPref, business } = useSettings();
  const stockEnabled = getPref('item', 'stockMaintenance');
  const barcodeEnabled = getPref('item', 'barcodeScan');
  const mrpEnabled = getPref('item', 'mrp');
  const itemWiseTaxEnabled = getPref('item', 'itemWiseTax');
  const itemWiseDiscountEnabled = getPref('item', 'itemWiseDiscount');
  const enableItem = getPref('item', 'enableItem');
  const wholesalePriceEnabled = getPref('item', 'wholesalePrice');
  const itemCategoryEnabled = getPref('item', 'itemCategory');
  const descriptionEnabled = getPref('item', 'description');
  const godownEnabled = getPref('general', 'enableGodown');
  const hsnSacEnabled = getPref('taxes', 'hsnSac');
  const serialTrackingEnabled = getPref('item', 'serialNumberTracking');
  const batchTrackingEnabled = getPref('item', 'batchTracking');
  const expiryDateEnabled = getPref('item', 'expiryDate');
  const mfgDateEnabled = getPref('item', 'manufacturingDate');
  const modelNoEnabled = getPref('item', 'modelNumber');
  const sizeEnabled = getPref('item', 'size');
  const fileInputRef = useRef(null);
  const productServicePref = getPref('item', 'productService');
  const manufacturingEnabled = getPref('item', 'manufacturing');
  const lowStockDialogEnabled = getPref('item', 'lowStockDialog');
  const defaultUnit = getPref('item', 'itemUnits');
  const defaultUnitAbbr = getPref('item', 'unit');
  const effectiveDefaultUnit = defaultUnit || defaultUnitAbbr || 'pcs';

  const [form, setForm] = useState({
    name: '', itemType: 'Product', sku: '', category: '', brand: '', unit: effectiveDefaultUnit, hsn: '', description: '',
    sellingPrice: '', discountType: 'none', discountValue: '', purchasePrice: '', supplier: '',
    wholesalePrices: [],
    trackInventory: true, openingStock: '', currentStock: '', minStock: 5, warehouse: '', storageLocation: '',
    gstRate: 0, taxIncluded: false, cgst: 0, sgst: 0, igst: 0,
    modelNo: '', size: '', serialNo: '', batchNo: '', expiryDate: '', mfgDate: '', mrp: 0,
  });
  const [activeTab, setActiveTab] = useState('pricing');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [godowns, setGodowns] = useState([]);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const [productsRes, godownsRes] = await Promise.all([
        productAPI.getAll(),
        godownEnabled ? godownAPI.getAll() : Promise.resolve({ data: [] }),
      ]);
      setProducts(productsRes.data);
      setGodowns(godownsRes.data);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    const defaultType = productServicePref === 'Service' ? 'Service' : 'Product';
    setForm({
      name: '', itemType: defaultType, sku: '', category: '', brand: '', unit: effectiveDefaultUnit, hsn: '', description: '',
      sellingPrice: '', discountType: 'none', discountValue: '', purchasePrice: '', supplier: '',
      wholesalePrices: [],
      trackInventory: true, openingStock: '', currentStock: '', minStock: 5, warehouse: '', storageLocation: '',
      gstRate: 0, taxIncluded: false, cgst: 0, sgst: 0, igst: 0,
      modelNo: '', size: '', serialNo: '', batchNo: '', expiryDate: '', mfgDate: '', mrp: 0,
    });
    setImages(prev => { prev.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); }); return []; });
    setEditingItem(null);
    setActiveTab('pricing');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingItem(product);
    setForm({
      name: product.name || '', itemType: product.itemType || 'Product', sku: product.sku || '',
      category: product.category || '', brand: product.brand || '', unit: product.unit || 'pcs',
      hsn: product.hsn || '', description: product.description || '',
      sellingPrice: product.price || '', discountType: 'none', discountValue: '',
      purchasePrice: product.costPrice || '', supplier: product.supplier || '',
      wholesalePrices: product.wholesalePrices || [],
      trackInventory: true, openingStock: '', currentStock: product.stock || '',
      minStock: product.minStock || 5, warehouse: product.warehouse || '',
      storageLocation: product.storageLocation || '',
      gstRate: product.gstRate || 0, taxIncluded: false, cgst: product.cgst || 0,
      sgst: product.sgst || 0, igst: product.igst || 0,
      modelNo: product.modelNo || '', size: product.size || '',
      serialNo: product.serialNo || '', batchNo: product.batchNo || '',
      expiryDate: product.expiryDate || '', mfgDate: product.mfgDate || '', mrp: product.mrp || 0,
    });
    if (product.image) setImages([product.image]);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'gstRate') {
      const rate = parseFloat(value) || 0;
      setForm(prev => ({ ...prev, gstRate: rate, cgst: rate / 2, sgst: rate / 2, igst: rate }));
    }
  };

  const handleSave = async (action = 'save') => {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    if (lowStockDialogEnabled && form.trackInventory && (parseInt(form.currentStock) || 0) < (parseInt(form.minStock) || 5)) {
      toast.warning(`Low stock alert: ${form.name} has only ${form.currentStock || 0} units (min: ${form.minStock || 5})`);
    }
    const payload = {
      name: form.name, itemType: form.itemType, sku: form.sku, category: form.category,
      brand: form.brand, unit: form.unit, hsn: form.hsn, description: form.description,
      price: parseFloat(form.sellingPrice) || 0, costPrice: parseFloat(form.purchasePrice) || 0,
      stock: parseInt(form.currentStock) || 0, minStock: parseInt(form.minStock) || 5,
      gstRate: parseFloat(form.gstRate) || 0, image: images[0] || '',
      supplier: form.supplier, warehouse: form.warehouse, storageLocation: form.storageLocation,
      modelNo: form.modelNo, size: form.size, serialNo: form.serialNo,
      batchNo: form.batchNo, expiryDate: form.expiryDate, mfgDate: form.mfgDate,
      mrp: parseFloat(form.mrp) || 0,
    };
    try {
      if (editingItem) {
        await productAPI.update(editingItem._id, payload);
        toast.success('Item updated');
      } else {
        await productAPI.create(payload);
        toast.success('Item created');
      }
      if (action === 'save_new') {
        resetForm();
        loadProducts();
      } else {
        setShowModal(false);
        resetForm();
        loadProducts();
      }
    } catch { toast.error('Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await productAPI.delete(id);
      toast.success('Item deleted');
      loadProducts();
    } catch { toast.error('Delete failed'); }
  };

  const handleDuplicate = async (product) => {
    try {
      await productAPI.create({ ...product, name: `${product.name} (Copy)`, sku: product.sku ? `${product.sku}-copy` : '' });
      toast.success('Item duplicated');
      loadProducts();
    } catch { toast.error('Duplicate failed'); }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(f => URL.createObjectURL(f));
    setImages(prev => {
      const updated = [...prev, ...newImages].slice(0, 5);
      return updated;
    });
  };

  const removeImage = (idx) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Computed values
  const inventoryValue = products.reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);
  const lowStockCount = products.filter(p => p.stock !== undefined && p.stock !== null && p.stock > 0 && p.stock <= (p.minStock || 5)).length;
  const serviceCount = products.filter(p => p.itemType === 'Service').length;
  const productCount = products.filter(p => p.itemType !== 'Service').length;

  const filtered = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.hsn?.includes(q);
      const matchCategory = categoryFilter === 'All' || p.category === categoryFilter;
      const matchType = typeFilter === 'All Items' || (typeFilter === 'Products' && p.itemType !== 'Service') || (typeFilter === 'Services' && p.itemType === 'Service');
      const matchStock = stockFilter === 'All' || (stockFilter === 'In Stock' && p.stock > (p.minStock || 5)) || (stockFilter === 'Low Stock' && p.stock > 0 && p.stock <= (p.minStock || 5)) || (stockFilter === 'Out of Stock' && (!p.stock || p.stock === 0));
      let matchProductService = true;
      if (productServicePref && productServicePref !== 'Both') {
        const typeFilter2 = productServicePref === 'Product' ? 'product' : 'service';
        matchProductService = (p.itemType || 'product').toLowerCase() === typeFilter2;
      }
      return matchSearch && matchCategory && matchType && matchStock && matchProductService;
    });
  }, [products, searchQuery, categoryFilter, stockFilter, typeFilter, productServicePref]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter, stockFilter, typeFilter]);

  const getStockStatus = (product) => {
    const stock = product.stock || 0;
    const min = product.minStock || 5;
    if (stock === 0) return { label: 'Out of Stock', variant: 'low', icon: AlertTriangle };
    if (stock <= min) return { label: 'Low Stock', variant: 'low', icon: AlertTriangle };
    return { label: 'In Stock', variant: 'healthy', icon: PackageCheck };
  };

  const TableHeader = () => (
    <thead>
      <tr className="border-b border-slate-100 dark:border-gray-700">
        {['Item', 'Category', 'HSN/SAC', 'Unit', 'Selling Price', 'Purchase Price', ...(wholesalePriceEnabled ? ['Wholesale Price'] : []), 'Stock', 'GST', ...(serialTrackingEnabled ? ['Serial No'] : []), ...(batchTrackingEnabled ? ['Batch No'] : []), ...(expiryDateEnabled ? ['Expiry'] : []), ...(modelNoEnabled ? ['Model No'] : []), ...(sizeEnabled ? ['Size'] : []), ...(manufacturingEnabled ? ['Mfg Date'] : []), ...(godownEnabled ? ['Godown'] : []), 'Status', ''].map(h => (
          <th key={h} className="px-4 py-3.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">{h}</th>
        ))}
      </tr>
    </thead>
  );

  const TableRow = ({ product, idx }) => {
    const stockStatus = getStockStatus(product);
    const isSelected = selectedProducts.includes(product._id);
    const Icon = product.itemType === 'Service' ? ClipboardList : Package;
    return (
      <motion.tr key={product._id} variants={itemVariants} layout
        className={`group border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50/50 dark:hover:bg-gray-700/20 transition-colors ${
          isSelected ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setDetailProductId(product._id)}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
            >
              {product.image ? (
                <img src={product.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
              )}
            </button>
            <div className="min-w-0">
              <button onClick={() => setDetailProductId(product._id)}
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
              >
                {product.name}
              </button>
              {product.sku && <p className="text-[11px] text-slate-400">SKU: {product.sku}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">{product.category || '—'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">{product.hsn || '—'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">{product.unit || 'pcs'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(product.price)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">{formatCurrency(product.costPrice || 0)}</span>
        </td>
        {wholesalePriceEnabled && (
          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
            {product.wholesalePrices?.length > 0 ? product.wholesalePrices.map(wp => `${wp.quantity}+: ${formatCurrency(wp.price)}`).join(', ') : '-'}
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              (product.stock || 0) === 0 ? 'bg-red-500' :
              (product.stock || 0) <= (product.minStock || 5) ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <span className={`text-sm font-semibold ${
              (product.stock || 0) === 0 ? 'text-red-600 dark:text-red-400' :
              (product.stock || 0) <= (product.minStock || 5) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'
            }`}>
              {product.stock || 0}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant="default">{(product.gstRate || 0)}%</Badge>
        </td>
        {serialTrackingEnabled && <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{product.serialNo || '-'}</td>}
        {batchTrackingEnabled && <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{product.batchNo || '-'}</td>}
        {expiryDateEnabled && <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : '-'}</td>}
        {modelNoEnabled && <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{product.modelNo || '-'}</td>}
        {sizeEnabled && <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{product.size || '-'}</td>}
        {manufacturingEnabled && (
          <td className="px-4 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">{product.mfgDate || '—'}</span>
          </td>
        )}
        {godownEnabled && (
          <td className="px-4 py-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {product.warehouse ? (godowns.find(g => g._id === product.warehouse)?.name || '—') : 'Main'}
            </span>
          </td>
        )}
        <td className="px-4 py-3">
          <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setDetailProductId(product._id)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="View"><Eye className="w-3.5 h-3.5" /></button>
            <button onClick={() => openEditModal(product)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDuplicate(product)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDelete(product._id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
              title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </motion.tr>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading items...</span>
        </div>
      </div>
    );
  }

  if (!enableItem) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Package className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Items Module Disabled</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">Items management is currently disabled in your settings. Enable "Item" from Settings → Item to manage your products and services.</p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Items</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your inventory, stock & services</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/dashboard/import-data')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={() => navigate('/dashboard/export-data')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4.5 h-4.5" /> Add Item
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Total Products', value: productCount, icon: Package, color: 'blue', bg: 'blue' },
          { label: 'Total Services', value: serviceCount, icon: ClipboardList, color: 'purple', bg: 'purple' },
          { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: 'red', bg: 'red' },
          { label: 'Inventory Value', value: formatCurrency(inventoryValue), icon: IndianRupee, color: 'emerald', bg: 'emerald' },
        ].map((stat, idx) => (
          <motion.div key={idx} variants={itemVariants}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 lg:p-5 hover:shadow-card-hover transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-${stat.bg}-50 dark:bg-${stat.bg}-500/10`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-lg lg:text-xl font-bold mt-0.5 text-slate-900 dark:text-slate-100 ${
                  typeof stat.value === 'string' ? 'text-emerald-600 dark:text-emerald-400' : ''
                } ${stat.label === 'Low Stock Items' && lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Search & Filters */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by item name, SKU, category or HSN..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {STOCK_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {TYPE_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="flex bg-slate-100 dark:bg-gray-700 rounded-xl p-0.5">
              <button onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
              ><List className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
              ><Grid3X3 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        {filtered.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-gray-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {paginated.length} of {filtered.length} items
              {searchQuery && <span> · searched: "{searchQuery}"</span>}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 text-slate-500 transition-colors"
              ><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    currentPage === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700'
                  }`}
                >{p}</button>
              ))}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30 text-slate-500 transition-colors"
              ><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Table / Grid View */}
      {paginated.length > 0 ? (
        viewMode === 'list' ? (
          <motion.div variants={itemVariants}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden"
          >
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <TableHeader />
                <tbody>
                  {paginated.map((product, idx) => (
                    <TableRow key={product._id} product={product} idx={idx} />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map(product => {
              const stockStatus = getStockStatus(product);
              const Icon = product.itemType === 'Service' ? ClipboardList : Package;
              return (
                <motion.div key={product._id} layout
                  className="group bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-4 hover:shadow-card-hover transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{product.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{product.category || 'No category'} · {product.unit}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(product)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDuplicate(product)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-purple-600 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Selling</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.price)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Purchase</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.costPrice || 0)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <StockHealthBar stock={product.stock || 0} minStock={product.minStock || 5} />
                    <div className="flex items-center justify-between">
                      <Badge variant="default">GST {(product.gstRate || 0)}%</Badge>
                      <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )
      ) : (
        <motion.div variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12"
        >
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-2xl mb-5">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              {searchQuery || categoryFilter !== 'All' ? 'No items match your filters' : 'No items yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {searchQuery || categoryFilter !== 'All'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first product or service item.'}
            </p>
            {!searchQuery && categoryFilter === 'All' && (
              <button onClick={openAddModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Add/Edit Item Modal - Vyapar Style */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`relative bg-white dark:bg-gray-800 shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-hidden flex ${showSettingsPanel ? 'rounded-lg' : 'rounded-lg'}`}
            >
              {/* Side Panel: Item Settings (slides in from right) */}
              <AnimatePresence>
                {showSettingsPanel && (
                  <motion.div initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="w-72 bg-slate-50 dark:bg-gray-900 border-r border-slate-200 dark:border-gray-700 flex flex-col flex-shrink-0"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Item Settings</h3>
                      <button onClick={() => setShowSettingsPanel(false)} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Additional Item Fields</div>
                      <button onClick={() => navigate('/settings')} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded text-left">
                        <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Item Custom Fields <HelpCircle className="w-3 h-3 text-slate-400" /></span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">Wholesale Price</span>
                        <input type="checkbox" checked={!!wholesalePriceEnabled} readOnly className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">Barcode Scan</span>
                        <input type="checkbox" checked={!!barcodeEnabled} readOnly className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">Item Category</span>
                        <input type="checkbox" checked={!!itemCategoryEnabled} readOnly className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">Description</span>
                        <input type="checkbox" checked={!!descriptionEnabled} readOnly className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-gray-700 p-3">
                      <button onClick={() => navigate('/settings')} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium">
                        <Settings2 className="w-3.5 h-3.5" /> More Settings
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Modal Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{editingItem ? 'Edit Item' : 'Add Item'}</h3>
                    {(!productServicePref || productServicePref === 'Both') && (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${form.itemType === 'Product' ? 'text-blue-600' : 'text-slate-500'}`}>Product</span>
                      <button onClick={() => handleInputChange('itemType', form.itemType === 'Product' ? 'Service' : 'Product')}
                        className={`relative w-10 h-5 rounded-full transition-colors ${form.itemType === 'Service' ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.itemType === 'Service' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className={`text-sm font-medium ${form.itemType === 'Service' ? 'text-blue-600' : 'text-slate-500'}`}>Service</span>
                    </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowSettingsPanel(!showSettingsPanel)} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded">
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 dark:bg-gray-900/30">
                  {/* Row 1: Item Name | Item HSN | Select Unit | Add Item Image */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 sm:col-span-4">
                      <input type="text" value={form.name} onChange={e => handleInputChange('name', e.target.value)}
                        placeholder="Item Name *"
                        className="w-full px-3 py-2.5 text-sm border-2 border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    {hsnSacEnabled && (
                      <div className="col-span-12 sm:col-span-3">
                        <div className="relative">
                          <input type="text" value={form.hsn} onChange={e => handleInputChange('hsn', e.target.value)}
                            placeholder="Item HSN"
                            className="w-full px-3 py-2.5 pr-9 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    )}
                    <div className="col-span-12 sm:col-span-2">
                      <button onClick={() => document.getElementById('unit-select')?.focus()}
                        className="w-full px-3 py-2.5 text-sm font-medium text-blue-600 border border-slate-300 dark:border-gray-600 rounded bg-slate-50 dark:bg-gray-700 hover:bg-slate-100 transition-colors">
                        <select id="unit-select" value={form.unit} onChange={e => handleInputChange('unit', e.target.value)}
                          className="bg-transparent focus:outline-none cursor-pointer w-full"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </button>
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5">
                        <Camera className="w-4 h-4" /> {images.length > 0 ? `${images.length} Image${images.length > 1 ? 's' : ''} Added` : 'Add Item Image'}
                      </button>
                      <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </div>
                  </div>

                  {/* Row 2: Category | Item Code + Assign Code */}
                  <div className="grid grid-cols-12 gap-3">
                    {itemCategoryEnabled && (
                      <div className="col-span-12 sm:col-span-6">
                        <select value={form.category} onChange={e => handleInputChange('category', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        >
                          <option value="">Category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                    <div className={`col-span-12 ${itemCategoryEnabled ? 'sm:col-span-6' : 'sm:col-span-12'}`}>
                      <div className="flex gap-2">
                        <input type="text" value={form.sku} onChange={e => handleInputChange('sku', e.target.value)}
                          placeholder="Item Code"
                          className="flex-1 px-3 py-2.5 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <button onClick={() => {
                          const code = `ITM-${Date.now().toString(36).toUpperCase()}`;
                          handleInputChange('sku', code);
                          toast.success('Code assigned');
                        }} className="px-3 py-2.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors whitespace-nowrap">
                          Assign Code
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional description/brand fields if enabled */}
                      {(descriptionEnabled || form.brand || form.size || modelNoEnabled) && (
                    <div className="grid grid-cols-12 gap-3">
                      {form.brand !== undefined && (
                        <div className="col-span-12 sm:col-span-4">
                          <input type="text" value={form.brand} onChange={e => handleInputChange('brand', e.target.value)}
                            placeholder="Brand"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      )}
                      {sizeEnabled && (
                        <div className="col-span-12 sm:col-span-4">
                          <input type="text" value={form.size} onChange={e => handleInputChange('size', e.target.value)}
                            placeholder="Size"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      )}
                      {modelNoEnabled && (
                        <div className="col-span-12 sm:col-span-4">
                          <input type="text" value={form.modelNo} onChange={e => handleInputChange('modelNo', e.target.value)}
                            placeholder="Model Number"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      )}
                      {descriptionEnabled && (
                        <div className="col-span-12 sm:col-span-4">
                          <input type="text" value={form.description} onChange={e => handleInputChange('description', e.target.value)}
                            placeholder="Description"
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tabs: Pricing | Stock */}
                  <div className="border-b border-slate-200 dark:border-gray-700 flex gap-6 pt-2">
                    <button onClick={() => setActiveTab('pricing')}
                      className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === 'pricing' ? 'text-red-500' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Pricing
                      {activeTab === 'pricing' && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-red-500" />}
                    </button>
                    {stockEnabled && (
                      <button onClick={() => setActiveTab('stock')}
                        className={`pb-2 text-sm font-semibold transition-colors relative ${activeTab === 'stock' ? 'text-red-500' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Stock
                        {activeTab === 'stock' && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-red-500" />}
                      </button>
                    )}
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'pricing' && (
                    <div className="space-y-4">
                      {/* Sale Price Card */}
                      <div className="bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Sale Price</h4>
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-12 sm:col-span-4 flex">
                            <input type="number" value={form.sellingPrice} onChange={e => handleInputChange('sellingPrice', e.target.value)}
                              placeholder="Sale Price"
                              className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <select className="px-2 py-2 text-xs border border-l-0 border-slate-300 dark:border-gray-600 rounded-r bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 focus:outline-none">
                              <option>Without Tax</option>
                              <option>With Tax</option>
                            </select>
                          </div>
                          {itemWiseDiscountEnabled && (
                            <div className="col-span-12 sm:col-span-5 flex">
                              <input type="number" value={form.discountValue} onChange={e => handleInputChange('discountValue', e.target.value)}
                                placeholder="Disc. On Sale Price"
                                className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                              <select value={form.discountType} onChange={e => handleInputChange('discountType', e.target.value)}
                                className="px-2 py-2 text-xs border border-l-0 border-slate-300 dark:border-gray-600 rounded-r bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                              >
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed ₹</option>
                              </select>
                            </div>
                          )}
                        </div>
                        {wholesalePriceEnabled && (
                          <div className="space-y-2 mt-3">
                            <label className="block text-xs font-semibold text-slate-500 uppercase">Wholesale Prices</label>
                            {(form.wholesalePrices || []).map((wp, i) => (
                              <div key={i} className="flex gap-2 items-center">
                                <input type="number" placeholder="Min Qty" value={wp.quantity}
                                  onChange={e => {
                                    const prices = [...(form.wholesalePrices || [])];
                                    prices[i] = { ...prices[i], quantity: parseInt(e.target.value) || 0 };
                                    handleInputChange('wholesalePrices', prices);
                                  }}
                                  className="w-24 px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700" />
                                <input type="number" placeholder="Price" value={wp.price}
                                  onChange={e => {
                                    const prices = [...(form.wholesalePrices || [])];
                                    prices[i] = { ...prices[i], price: parseFloat(e.target.value) || 0 };
                                    handleInputChange('wholesalePrices', prices);
                                  }}
                                  className="w-28 px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700" />
                                <button onClick={() => {
                                  const prices = (form.wholesalePrices || []).filter((_, j) => j !== i);
                                  handleInputChange('wholesalePrices', prices);
                                }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                              </div>
                            ))}
                            <button onClick={() => handleInputChange('wholesalePrices', [...(form.wholesalePrices || []), { quantity: 0, price: 0 }])}
                              className="text-xs text-blue-600 hover:text-blue-700">+ Add Tier</button>
                          </div>
                        )}
                      </div>

                      {/* Purchase Price + Taxes row */}
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 sm:col-span-6 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Purchase Price</h4>
                          <div className="flex">
                            <input type="number" value={form.purchasePrice} onChange={e => handleInputChange('purchasePrice', e.target.value)}
                              placeholder="Purchase Price"
                              className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <select className="px-2 py-2 text-xs border border-l-0 border-slate-300 dark:border-gray-600 rounded-r bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 focus:outline-none">
                              <option>Without Tax</option>
                              <option>With Tax</option>
                            </select>
                          </div>
                        </div>
                        {itemWiseTaxEnabled && (
                          <div className="col-span-12 sm:col-span-6 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Taxes</h4>
                            <select value={form.gstRate} onChange={e => handleInputChange('gstRate', parseFloat(e.target.value))}
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            >
                              <option value="0">None</option>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                              <option value="0.25">0.25%</option>
                              <option value="3">3%</option>
                              <option value="40">40%</option>
                              <option value="-1">Exempt</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* MRP field if enabled */}
                      {mrpEnabled && (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">MRP</label>
                            <input type="number" value={form.mrp} onChange={e => handleInputChange('mrp', e.target.value)}
                              placeholder="Maximum Retail Price"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'stock' && stockEnabled && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Track Inventory</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Enable stock tracking for this item</p>
                        </div>
                        <button onClick={() => handleInputChange('trackInventory', !form.trackInventory)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${form.trackInventory ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.trackInventory ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>

                      {form.trackInventory && (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-12 sm:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Opening Stock</label>
                            <input type="number" value={form.openingStock} onChange={e => handleInputChange('openingStock', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Current Stock</label>
                            <input type="number" value={form.currentStock} onChange={e => handleInputChange('currentStock', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Min Stock Alert</label>
                            <input type="number" value={form.minStock} onChange={e => handleInputChange('minStock', e.target.value)}
                              placeholder="5"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {form.trackInventory && (
                        <div className="bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg p-3">
                          <StockHealthBar stock={parseInt(form.currentStock) || 0} minStock={parseInt(form.minStock) || 5} />
                        </div>
                      )}

                      {godownEnabled && form.trackInventory && (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                              <Warehouse className="w-3 h-3 inline mr-1" />
                              Godown / Warehouse
                            </label>
                            <select value={form.warehouse || ''} onChange={e => handleInputChange('warehouse', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            >
                              <option value="">Main Warehouse</option>
                              {godowns.map(g => (
                                <option key={g._id} value={g._id}>{g.name}{g.code ? ` (${g.code})` : ''}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              Storage Location
                            </label>
                            <input type="text" value={form.storageLocation || ''} onChange={e => handleInputChange('storageLocation', e.target.value)}
                              placeholder="e.g. Shelf A3, Rack 2"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {(serialTrackingEnabled || batchTrackingEnabled || expiryDateEnabled) && form.trackInventory && (
                        <div className="grid grid-cols-12 gap-3">
                          {serialTrackingEnabled && (
                            <div className="col-span-12 sm:col-span-6">
                              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Serial Number</label>
                              <input type="text" value={form.serialNo} onChange={e => handleInputChange('serialNo', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                            </div>
                          )}
                          {batchTrackingEnabled && (
                            <div className="col-span-12 sm:col-span-6">
                              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Batch No.</label>
                              <input type="text" value={form.batchNo} onChange={e => handleInputChange('batchNo', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                            </div>
                          )}
                          {expiryDateEnabled && (
                            <div className="col-span-12 sm:col-span-6">
                              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Expiry Date</label>
                              <input type="date" value={form.expiryDate} onChange={e => handleInputChange('expiryDate', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <button onClick={() => handleSave('save_new')}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-gray-600 rounded hover:bg-slate-50 transition-colors"
                  >Save & New</button>
                  <button onClick={() => handleSave('save')}
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >Save</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailProductId && (
          <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ProductDetailModal = ({ productId, onClose }) => {
  const [product, setProduct] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          productAPI.getById(productId),
          productAPI.getSales(productId),
        ]);
        setProduct(pRes.data);
        setSalesData(sRes.data);
      } catch { toast.error('Failed to load product details'); }
      finally { setLoading(false); }
    };
    load();
  }, [productId]);

  if (loading) return null;

  if (!product) return null;

  const isLowStock = product.stock <= (product.minStock || 5);
  const Icon = product.itemType === 'Service' ? ClipboardList : Package;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-elevated w-full max-w-lg max-h-[85vh] overflow-y-auto border border-slate-200/80 dark:border-gray-700"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
              {product.image ? <img src={product.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <Icon className="w-4 h-4 text-slate-500" />}
            </div>
            {product.name}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Selling Price', value: formatCurrency(product.price), color: 'blue' },
              { label: 'Purchase Price', value: formatCurrency(product.costPrice || 0), color: 'emerald' },
              { label: 'Stock', value: `${product.stock || 0} ${product.unit || ''}`, color: isLowStock ? 'red' : 'slate' },
              { label: 'GST Rate', value: `${product.gstRate || 0}%`, color: 'purple' },
            ].map((s, idx) => (
              <div key={idx} className={`bg-${s.color}-50 dark:bg-${s.color}-500/10 rounded-xl p-3 border border-${s.color}-100 dark:border-${s.color}-500/20`}>
                <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            {product.category && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-gray-700/30 rounded-lg">
                <span className="text-slate-500 dark:text-slate-400">Category</span>
                <span className="text-slate-900 dark:text-slate-100 font-medium">{product.category}</span>
              </div>
            )}
            {product.sku && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-gray-700/30 rounded-lg">
                <span className="text-slate-500 dark:text-slate-400">SKU</span>
                <span className="text-slate-900 dark:text-slate-100 font-medium font-mono">{product.sku}</span>
              </div>
            )}
            {product.hsn && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-gray-700/30 rounded-lg">
                <span className="text-slate-500 dark:text-slate-400">HSN/SAC</span>
                <span className="text-slate-900 dark:text-slate-100 font-medium font-mono">{product.hsn}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-gray-700/30 rounded-lg">
              <span className="text-slate-500 dark:text-slate-400">Status</span>
              {isLowStock ? (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md">Low Stock</span>
              ) : (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">In Stock</span>
              )}
            </div>
          </div>

          {/* Barcode & QR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4 text-center">
              <Barcode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Barcode</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">{product.sku || product._id?.slice(-8) || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-xl p-4 text-center">
              <QrCode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">QR Code</p>
              <p className="text-[10px] text-slate-400 mt-1">Scan to view item</p>
            </div>
          </div>

          {product.description && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Description</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">{product.description}</p>
            </div>
          )}

          {salesData && (
            <div className="border-t border-slate-100 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-400" /> Sales History
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3">
                  <p className="text-2xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Sold</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{salesData.totalQty || 0}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
                  <p className="text-2xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Revenue</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(salesData.totalRevenue || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Products;
