import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanBarcode, Camera, Upload, FileSpreadsheet, Database, History, ArrowLeft,
  ArrowRight, X, CheckCircle2, AlertCircle, Loader2, Search, Package,
  Plus, Save, Eye, Download, Trash2, ChevronRight, Settings2, Table2, BarChart3, Play, RefreshCw, Sun, Moon, Zap, QrCode, Image, FileText, List, Info, AlertTriangle, Clock, Printer, Filter, Grid3X3,
} from 'lucide-react';
import { toast } from 'react-toastify';
import barcodeAPI from '../services/barcodeAPI';

const SCANNER_STEPS = ['select_method', 'live_scanner', 'manual', 'image_upload', 'csv_import', 'product_form', 'summary'];

const BARCODE_FORMATS = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code128', 'Code39', 'QR_CODE'];

const METHOD_CARDS = [
  { id: 'live_scanner', label: 'Live Barcode Scanner', icon: Camera, desc: 'Use your device camera to scan barcodes in real time', color: 'blue' },
  { id: 'usb_scanner', label: 'USB Scanner', icon: Zap, desc: 'Connect a USB barcode scanner and scan directly', color: 'purple' },
  { id: 'camera', label: 'Mobile Camera', icon: QrCode, desc: 'Use your mobile camera with auto-focus and torch', color: 'indigo' },
  { id: 'image_upload', label: 'Upload Barcode Image', icon: Image, desc: 'Upload a PNG, JPG, or WEBP image containing a barcode', color: 'emerald' },
  { id: 'csv_import', label: 'Upload CSV / Excel', icon: FileSpreadsheet, desc: 'Bulk import products from CSV, XLS, or XLSX files', color: 'orange' },
  { id: 'database_lookup', label: 'Barcode Database Lookup', icon: Database, desc: 'Look up product details from barcode database', color: 'cyan' },
];

const ImportFromBarcode = () => {
  const [step, setStep] = useState('select_method');
  const [method, setMethod] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [product, setProduct] = useState(null);
  const [productFound, setProductFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [decodingImage, setDecodingImage] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvMapping, setCsvMapping] = useState({});
  const [csvImporting, setCsvImporting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStats, setHistoryStats] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [importOptions, setImportOptions] = useState({
    createNew: true, updateExisting: true, updatePrices: false, updateStock: false,
    updateGST: false, skipDuplicates: false, overwriteExisting: false,
  });
  const [stockUpdateMode, setStockUpdateMode] = useState('add');
  const [priceUpdateMode, setPriceUpdateMode] = useState('sale_price');
  const [duplicateHandling, setDuplicateHandling] = useState('update');
  const [productForm, setProductForm] = useState({
    barcode: '', name: '', sku: '', category: '', brand: '', unit: 'pcs',
    salePrice: '', purchasePrice: '', mrp: '', gstRate: '', hsn: '',
    stock: '', minStock: '5', description: '', subcategory: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const codeReaderRef = useRef(null);
  const usbInputRef = useRef(null);
  const [scannerFormat, setScannerFormat] = useState(null);

  useEffect(() => {
    fetchHistoryStats();
    fetchScanHistory();
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const fetchHistoryStats = async () => {
    try {
      const { data } = await barcodeAPI.getDashboardStats();
      setHistoryStats(data);
    } catch { }
  };

  const fetchScanHistory = async () => {
    try {
      const { data } = await barcodeAPI.getScanHistory({ limit: 10 });
      setScanHistory(data.scans || []);
    } catch { }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await barcodeAPI.getHistory({ limit: 50 });
      setHistoryData(data.imports || []);
    } catch { } finally { setHistoryLoading(false); }
  };

  const scanByCamera = useCallback(async () => {
    if (!window.navigator?.mediaDevices?.getUserMedia) {
      toast.error('Camera not available on this device');
      return;
    }
    setScanning(true);
    setShowScanner(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          const barcode = result.getText();
          const format = result.getBarcodeFormat();
          setScannedBarcode(barcode);
          setScannerFormat(format);
          handleBarcodeFound(barcode, format);
          if (!importOptions.continuousScan) {
            stopCamera();
          }
        }
      });
    } catch (err) {
      toast.error('Camera access denied or not available');
      setScanning(false);
      setShowScanner(false);
    }
  }, [importOptions.continuousScan]);

  const stopCamera = () => {
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch { }
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
    setShowScanner(false);
    setTorchOn(false);
  };

  const handleBarcodeFound = async (barcode, format) => {
    if (!barcode) return;
    setScannedBarcode(barcode);
    try {
      const { data } = await barcodeAPI.scan({ barcode, format: format || 'unknown', method });
      setLastScan(data);
      setProductFound(data.found);
      setProduct(data.product);
      if (data.found) {
        toast.success(`Product found: ${data.product?.name}`);
        setProductForm(prev => ({
          ...prev,
          barcode: data.barcode,
          name: data.product?.name || prev.name,
          sku: data.product?.sku || prev.sku,
          category: data.product?.category || prev.category,
          brand: data.product?.brand || prev.brand,
          unit: data.product?.unit || prev.unit,
          salePrice: data.product?.price?.toString() || prev.salePrice,
          purchasePrice: data.product?.costPrice?.toString() || prev.purchasePrice,
          mrp: data.product?.mrp?.toString() || prev.mrp,
          gstRate: data.product?.gstRate?.toString() || prev.gstRate,
          hsn: data.product?.hsn || prev.hsn,
          stock: data.product?.stock?.toString() || prev.stock,
          minStock: data.product?.minStock?.toString() || prev.minStock,
          description: data.product?.description || prev.description,
        }));
      } else {
        toast.info('New barcode detected');
        setProductForm(prev => ({ ...prev, barcode: data.barcode }));
      }
      fetchScanHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Scan failed');
    }
  };

  const handleUSBScan = async (e) => {
    const value = e.target.value;
    if (value && value.length >= 6) {
      setScannedBarcode(value);
      await handleBarcodeFound(value, 'Code128');
      e.target.value = '';
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setDecodingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await barcodeAPI.uploadImage(formData);
      if (data.decoded) {
        toast.success(`Barcode decoded: ${data.barcode}`);
        setLastScan(data);
        setProductFound(data.found);
        setProduct(data.product);
        if (data.product) {
          setProductForm(prev => ({
            ...prev, barcode: data.barcode, name: data.product.name || prev.name,
            sku: data.product.sku || prev.sku, category: data.product.category || prev.category,
            salePrice: data.product.price?.toString() || prev.salePrice,
            purchasePrice: data.product.costPrice?.toString() || prev.purchasePrice,
            stock: data.product.stock?.toString() || prev.stock, gstRate: data.product.gstRate?.toString() || prev.gstRate,
            hsn: data.product.hsn || prev.hsn, brand: data.product.brand || prev.brand,
            unit: data.product.unit || prev.unit, mrp: data.product.mrp?.toString() || prev.mrp,
          }));
        } else {
          setProductForm(prev => ({ ...prev, barcode: data.barcode }));
        }
      } else {
        toast.error('Could not decode barcode from image');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image decoding failed');
    } finally { setDecodingImage(false); }
  };

  const handleCSVUpload = async (file) => {
    if (!file) return;
    setCsvFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await barcodeAPI.previewCSV(formData);
      setCsvPreview(data);
      setCsvMapping(data.autoMapping || {});
      toast.success(`Preview ready: ${data.summary.totalRows} rows found`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV preview failed');
    }
  };

  const executeCSVImport = async () => {
    if (!csvPreview) return;
    setCsvImporting(true);
    try {
      const { data } = await barcodeAPI.executeCSV({
        importId: csvPreview.importId,
        mapping: csvMapping,
        options: importOptions,
        stockUpdateMode,
        priceUpdateMode,
        duplicateHandling,
        rows: csvPreview.rows,
        filePath: csvPreview.filePath,
      });
      setImportResult(data);
      setStep('summary');
      toast.success(`Import completed: ${data.summary.productsCreated} created, ${data.summary.productsUpdated} updated`);
      fetchHistoryStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setCsvImporting(false); }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name) { toast.error('Product name is required'); return; }
    setSaveLoading(true);
    try {
      if (product && productFound) {
        const { data } = await barcodeAPI.updateProduct(product._id, productForm);
        setProduct(data.product);
        toast.success('Product updated');
      } else {
        const { data } = await barcodeAPI.createProduct(productForm);
        setProduct(data.product);
        setProductFound(true);
        toast.success('Product created');
        fetchHistoryStats();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaveLoading(false); }
  };

  const resetAll = () => {
    setStep('select_method');
    setMethod(null);
    setScannedBarcode('');
    setLastScan(null);
    setProduct(null);
    setProductFound(false);
    setImageFile(null);
    setImagePreview(null);
    setCsvFile(null);
    setCsvPreview(null);
    setImportResult(null);
    setProductForm({
      barcode: '', name: '', sku: '', category: '', brand: '', unit: 'pcs',
      salePrice: '', purchasePrice: '', mrp: '', gstRate: '', hsn: '',
      stock: '', minStock: '5', description: '', subcategory: '',
    });
    stopCamera();
  };

  const handleTorchToggle = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.getCapabilities().torch) {
        try {
          await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
          setTorchOn(!torchOn);
        } catch { toast.error('Torch not available'); }
      } else { toast.error('Torch not available on this device'); }
    }
  };

  const renderMethodSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import From Barcode</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Create and update products using barcode scanning</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm">
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METHOD_CARDS.map((m) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id} whileHover={{ y: -2 }}
              onClick={() => { setMethod(m.id); setStep(m.id === 'csv_import' ? 'csv_import' : m.id === 'image_upload' ? 'image_upload' : 'live_scanner'); }}
              className="group bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-5 text-left hover:shadow-lg transition-all text-start"
            >
              <div className={`w-12 h-12 rounded-xl bg-${m.color}-100 dark:bg-${m.color}-500/20 flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 text-${m.color}-600 dark:text-${m.color}-400`} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{m.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderScanner = () => (
    <div className="space-y-6">
      <button onClick={() => { stopCamera(); setStep('select_method'); }} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {method === 'usb_scanner' ? 'USB Barcode Scanner' : method === 'image_upload' ? 'Upload Barcode Image' : 'Barcode Scanner'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {method !== 'usb_scanner' && method !== 'image_upload' && (
                <>
                  {!scanning ? (
                    <button onClick={scanByCamera} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      <Camera className="w-4 h-4" /> Start Scanner
                    </button>
                  ) : (
                    <button onClick={stopCamera} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                      <X className="w-4 h-4" /> Stop Scanner
                    </button>
                  )}
                  <button onClick={handleTorchToggle} disabled={!scanning} className="p-2 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">
                    {torchOn ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {method === 'usb_scanner' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">Connect your USB barcode scanner and focus the cursor below. Scanned barcodes will be captured automatically.</p>
              </div>
              <input
                ref={usbInputRef} autoFocus
                type="text" placeholder="Scan barcode with your USB scanner..."
                onChange={handleUSBScan}
                className="w-full px-4 py-3 border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg text-center"
              />
            </div>
          ) : method === 'image_upload' ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                className="border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('barcode-image-input')?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-3">
                    <img src={imagePreview} alt="Barcode" className="max-h-48 mx-auto rounded-lg" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">{imageFile?.name}</p>
                    <button onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }} className="text-sm text-red-600 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Image className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Drop barcode image here or click to browse</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">PNG, JPG, JPEG, WEBP</p>
                  </div>
                )}
                <input id="barcode-image-input" type="file" accept="image/png,image/jpg,image/jpeg,image/webp" className="hidden" onChange={(e) => handleImageUpload(e.target.files[0])} />
              </div>
              {decodingImage && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Decoding barcode...
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`relative rounded-xl overflow-hidden bg-black ${scanning ? 'h-64' : 'h-48 flex items-center justify-center bg-slate-100 dark:bg-gray-700'}`}>
                {scanning ? (
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                ) : (
                  <div className="text-center text-slate-400 dark:text-slate-500">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Start Scanner" to begin</p>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 border-2 border-blue-500/50 rounded-xl pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1 border-0 border-red-500">
                      <div className="h-0.5 bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} placeholder="Or type barcode manually..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
                </div>
                <button onClick={() => scannedBarcode && handleBarcodeFound(scannedBarcode, 'manual')} disabled={!scannedBarcode} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {lastScan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {productFound ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {productFound ? 'Product Found' : 'New Barcode'}
                </h3>
              </div>
              <span className="text-xs font-mono bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded text-slate-600 dark:text-slate-400">{lastScan.format}</span>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Barcode</p>
                <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{lastScan.barcode}</p>
              </div>
              {product && (
                <>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Product</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{product.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Stock</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{product.stock ?? 0} {product.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Price</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">₹{product.price ?? 0}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!productFound && (
                <button onClick={() => setStep('product_form')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" /> Create Product
                </button>
              )}
              {productFound && (
                <>
                  <button onClick={() => setStep('product_form')} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                    <Package className="w-4 h-4" /> Update Stock
                  </button>
                  <button onClick={() => setStep('product_form')} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    <Settings2 className="w-4 h-4" /> Edit Product
                  </button>
                </>
              )}
              {scanning && importOptions.continuousScan && (
                <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                  <Loader2 className="w-3 h-3 animate-spin" /> Waiting for next scan...
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderProductForm = () => (
    <div className="space-y-6">
      <button onClick={() => setStep('live_scanner')} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Scanner
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{productFound ? 'Edit Product' : 'Create New Product'}</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Barcode *</label>
              <input type="text" value={productForm.barcode} onChange={(e) => setProductForm(p => ({ ...p, barcode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Product Name *</label>
              <input type="text" value={productForm.name} onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">SKU</label>
              <input type="text" value={productForm.sku} onChange={(e) => setProductForm(p => ({ ...p, sku: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Category</label>
              <input type="text" value={productForm.category} onChange={(e) => setProductForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Brand</label>
              <input type="text" value={productForm.brand} onChange={(e) => setProductForm(p => ({ ...p, brand: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Unit</label>
              <select value={productForm.unit} onChange={(e) => setProductForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                {['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'ft', 'box', 'dozen', 'pair', 'set', 'pack'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Sale Price (₹)</label>
              <input type="number" step="0.01" min="0" value={productForm.salePrice} onChange={(e) => setProductForm(p => ({ ...p, salePrice: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Purchase Price (₹)</label>
              <input type="number" step="0.01" min="0" value={productForm.purchasePrice} onChange={(e) => setProductForm(p => ({ ...p, purchasePrice: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">MRP (₹)</label>
              <input type="number" step="0.01" min="0" value={productForm.mrp} onChange={(e) => setProductForm(p => ({ ...p, mrp: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">GST Rate (%)</label>
              <select value={productForm.gstRate} onChange={(e) => setProductForm(p => ({ ...p, gstRate: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                {[0, 5, 12, 18, 28].map(r => (<option key={r} value={r}>{r}%</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">HSN Code</label>
              <input type="text" value={productForm.hsn} onChange={(e) => setProductForm(p => ({ ...p, hsn: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Opening Stock</label>
              <input type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm(p => ({ ...p, stock: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Min Stock</label>
              <input type="number" min="0" value={productForm.minStock} onChange={(e) => setProductForm(p => ({ ...p, minStock: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Description</label>
              <textarea rows={2} value={productForm.description} onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-gray-700">
            <button onClick={handleSaveProduct} disabled={saveLoading || !productForm.name} className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-soft">
              {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveLoading ? 'Saving...' : productFound ? 'Update Product' : 'Create Product'}
            </button>
            <button onClick={() => setStep('live_scanner')} className="px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCSVImport = () => (
    <div className="space-y-6">
      <button onClick={() => { setCsvPreview(null); setCsvFile(null); setStep('select_method'); }} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bulk Import from CSV / Excel</h2>
          </div>
        </div>
        <div className="p-6">
          {!csvPreview ? (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-1">Required CSV Format</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-mono">Barcode,Name,SKU,Category,PurchasePrice,SalePrice,GST,Stock,Unit</p>
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xls') || f.name.endsWith('.xlsx'))) handleCSVUpload(f); }}
                className="border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-orange-400 dark:hover:border-orange-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Drop CSV, XLS, or XLSX file here or click to browse</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Supports up to 10,000 rows</p>
              </div>
              <input id="csv-file-input" type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => handleCSVUpload(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{csvPreview.summary.totalRows}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Total Rows</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{csvPreview.summary.validRows}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Valid Rows</p>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{csvPreview.summary.invalidRows}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Invalid Rows</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{csvPreview.summary.duplicateBarcodes}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Duplicates</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{csvPreview.summary.newProducts}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">New Products</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Column Mapping</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {csvPreview.headers?.filter(h => h).map((header) => (
                    <div key={header} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-32 truncate">{header}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <select value={csvMapping[header] || ''} onChange={(e) => setCsvMapping(m => ({ ...m, [header]: e.target.value }))} className="flex-1 px-2 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="">Ignore</option>
                        {['barcode', 'name', 'sku', 'category', 'brand', 'unit', 'salePrice', 'purchasePrice', 'mrp', 'gstRate', 'hsn', 'stock', 'minStock', 'description'].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Import Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.createNew} onChange={(e) => setImportOptions(o => ({ ...o, createNew: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Create New Products
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.updateExisting} onChange={(e) => setImportOptions(o => ({ ...o, updateExisting: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Update Existing Products
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.updatePrices} onChange={(e) => setImportOptions(o => ({ ...o, updatePrices: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Update Prices
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.updateStock} onChange={(e) => setImportOptions(o => ({ ...o, updateStock: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Update Stock
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.updateGST} onChange={(e) => setImportOptions(o => ({ ...o, updateGST: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Update GST
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.skipDuplicates} onChange={(e) => setImportOptions(o => ({ ...o, skipDuplicates: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Skip Duplicates
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input type="checkbox" checked={importOptions.overwriteExisting} onChange={(e) => setImportOptions(o => ({ ...o, overwriteExisting: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Overwrite Existing
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Stock Update Mode</label>
                  <select value={stockUpdateMode} onChange={(e) => setStockUpdateMode(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="add">Add Stock</option>
                    <option value="replace">Replace Stock</option>
                    <option value="adjust">Adjust Stock</option>
                    <option value="set_exact">Set Exact Quantity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Price Update Mode</label>
                  <select value={priceUpdateMode} onChange={(e) => setPriceUpdateMode(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="sale_price">Update Sale Price</option>
                    <option value="purchase_price">Update Purchase Price</option>
                    <option value="mrp">Update MRP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Duplicate Handling</label>
                  <select value={duplicateHandling} onChange={(e) => setDuplicateHandling(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="skip">Skip</option>
                    <option value="update">Update Existing</option>
                    <option value="merge">Merge</option>
                    <option value="replace">Replace</option>
                  </select>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-gray-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-gray-700/50">
                      {csvPreview.headers?.filter(h => h).map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                    {csvPreview.rows?.slice(0, 10).map((row) => (
                      <tr key={row.rowNumber} className={row.valid ? '' : 'bg-red-50 dark:bg-red-500/5'}>
                        {csvPreview.headers?.filter(h => h).map(h => {
                          const field = csvMapping[h] || h;
                          return (
                            <td key={h + row.rowNumber} className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {row.data[field] || row.data[h] || '-'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="text-xs text-red-500" title={row.errors.join(', ')}>
                              <AlertCircle className="w-3.5 h-3.5 inline" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button onClick={executeCSVImport} disabled={csvImporting || csvPreview.summary.validRows === 0} className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-soft">
                  {csvImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {csvImporting ? 'Importing...' : `Import ${csvPreview.summary.validRows} Products`}
                </button>
                <button onClick={() => { setCsvPreview(null); setCsvFile(null); }} className="px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              </div>
              {csvImporting && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">Processing import... This may take a while for large files.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSummary = () => {
    if (!importResult) return null;
    const s = importResult.summary;
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {s.errors > 0 && s.productsCreated === 0 ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : s.errors > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import Complete</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{s.productsCreated}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Created</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{s.productsUpdated}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Updated</p>
              </div>
              <div className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{s.productsSkipped}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Skipped</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{s.errors}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Errors</p>
              </div>
            </div>
            {importResult.duration && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Import took {(importResult.duration / 1000).toFixed(1)} seconds</p>
            )}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-gray-700 mt-4">
              <button onClick={resetAll} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <RefreshCw className="w-4 h-4" /> Import More
              </button>
              <button onClick={() => fetchHistoryStats()} className="px-4 py-2.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                <Eye className="w-4 h-4" /> View History
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-6">
      <button onClick={() => setShowHistory(false)} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import History</h2>
            </div>
            <button onClick={fetchHistory} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
        <div className="p-6">
          {historyData.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No import history yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Start by scanning or importing barcodes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyData.map((h) => (
                <div key={h._id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/30 rounded-xl border border-slate-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${h.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20' : h.status === 'partial' ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                      {h.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> :
                       h.status === 'partial' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                       <X className="w-5 h-5 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{h.method?.replace(/_/g, ' ')}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{h.summary?.productsCreated || 0} created</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{h.summary?.productsUpdated || 0} updated</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-400">{h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : h.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                      {h.status}
                    </span>
                    <button onClick={async () => { try { const res = await barcodeAPI.deleteHistory(h._id); toast.success('Deleted'); fetchHistory(); } catch { toast.error('Delete failed'); } }} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (step === 'summary' && importResult) return renderSummary();
  if (showHistory) return renderHistory();
  if (step === 'select_method') return renderMethodSelection();
  if (step === 'csv_import') return renderCSVImport();
  if (step === 'image_upload') return renderScanner();
  if (step === 'product_form') return renderProductForm();
  if (step === 'live_scanner') return renderScanner();

  return renderMethodSelection();
};

export default ImportFromBarcode;
