import { useState, useEffect, useCallback } from 'react';
import { settingAPI } from '../services/api';

const defaultPrefs = {
  general: {
    enablePasscode: false,
    businessCurrency: 'INR',
    amountDecimalPlaces: '2',
    gstin: '',
    stopSaleOnNegativeStock: false,
    blockNewItemsFromTransaction: false,
    blockNewPartiesFromTransaction: false,
    estimateQuotation: true,
    proformaInvoice: false,
    salePurchaseOrder: false,
    otherIncome: true,
    fixedAssets: false,
    deliveryChallan: true,
    goodsReturnOnDC: false,
    printAmountOnDC: true,
    enableGodown: true,
    autoBackup: true,
    auditTrail: false,
    zoomLevel: '100',
  },
  transaction: {
    invoiceNo: 'Auto',
    addTimeOnTransactions: false,
    cashSaleByDefault: false,
    billingNameOfParties: 'Registered',
    customerPODetails: false,
    inclusiveExclusiveTax: 'Inclusive',
    displayPurchasePrice: false,
    lastSalePrice: true,
    lastPurchasePrice: true,
    freeItemQuantity: true,
    count: '1',
    transactionWiseTax: false,
    transactionWiseDiscount: true,
    roundOffTotal: true,
    roundingMethod: 'Normal',
    eWayBillNo: false,
    quickEntry: false,
    doNotShowInvoicePreview: false,
    passcodeForEditDelete: false,
    discountDuringPayments: false,
    linkPaymentsToInvoice: false,
    dueDatesPaymentTerms: true,
    showProfitWhileCreatingInvoice: false,
    termsAndConditions: true,
    additionalFields: false,
    transportationDetails: false,
    additionalCharges: false,
    salePrefix: 'SALE-',
    creditNotePrefix: 'CN-',
    saleOrderPrefix: 'SO-',
    purchaseOrderPrefix: 'PO-',
    estimatePrefix: 'EST-',
    proformaPrefix: 'PRO-',
    deliveryChallanPrefix: 'DC-',
    paymentInPrefix: 'PI-',
    receiptPrefix: 'RCP-',
  },
  print: {
    balanceAmount: true,
    currentBalance: true,
    taxDetails: true,
    youSaved: true,
    printAmountWithGrouping: true,
    amountInWords: true,
    amountInWordsFormat: 'Indian',
    footerSettings: true,
    printDescription: true,
    termsConditions: true,
    receivedBy: true,
    deliveredBy: true,
    signature: true,
    paymentMode: true,
    acknowledgement: false,
    paperSize: 'A4',
    orientation: 'Portrait',
    companyNameTextSize: '16',
    invoiceTextSize: '14',
    printOriginalDuplicate: 'Original',
    topPDFMargin: '10',
    printerType: 'regular',
    makeThermalDefault: false,
    thermalPageSize: '3inch',
    thermalCustomChars: '48',
    printingType: 'Text Printing',
    useTextStyling: true,
    autoCutPaper: false,
    openCashDrawer: false,
    extraLinesAtEnd: '0',
    numberOfCopies: '1',
    showCompanyName: true,
    showCompanyLogo: true,
    showAddress: true,
    showEmail: true,
    showPhone: true,
    showGSTIN: true,
    thermalTheme1: true,
    thermalTheme2: false,
    thermalTheme3: false,
    thermalTheme4: false,
    showItemSNo: true,
    showItemHSN: true,
    showItemUOM: true,
    showItemMRP: true,
    showItemDescription: true,
    showBatchNo: true,
    showExpDate: true,
    showMfgDate: true,
    showSize: true,
    showModelNo: true,
    showSerialNo: true,
    showTotalItemQty: true,
    showAmountDecimal: true,
    receivedAmount: true,
    tallyTheme: false,
    landscapeTheme1: false,
    landscapeTheme2: false,
    gstTheme: true,
    accentColor: '#2563EB',
  },
  taxes: {
    enableGST: true,
    hsnSac: true,
    additionalCess: false,
    reverseCharge: false,
    placeOfSupply: true,
    compositionScheme: false,
    enableTCS: false,
    enableTDS: false,
    taxRates: [
      { igst: 0, cgst: 0, sgst: 0, label: 'GST 0%' },
      { igst: 0.25, cgst: 0.125, sgst: 0.125, label: 'GST 0.25%' },
      { igst: 3, cgst: 1.5, sgst: 1.5, label: 'GST 3%' },
      { igst: 5, cgst: 2.5, sgst: 2.5, label: 'GST 5%' },
      { igst: 12, cgst: 6, sgst: 6, label: 'GST 12%' },
      { igst: 18, cgst: 9, sgst: 9, label: 'GST 18%' },
      { igst: 28, cgst: 14, sgst: 14, label: 'GST 28%' },
      { igst: 40, cgst: 20, sgst: 20, label: 'GST 40%' },
    ],
  },
  transactionMessage: {
    sendViaVyapar: false,
    sendViaWhatsApp: false,
    sendMessageToParty: true,
    sendCopyToSelf: false,
    sendTransactionUpdates: true,
    autoShareInvoices: false,
    currentBalance: true,
    webInvoiceLink: true,
    paymentLink: true,
    autoMsgSales: true,
    autoMsgPurchase: true,
    autoMsgSalesReturn: false,
    autoMsgPurchaseReturn: false,
    autoMsgPaymentIn: true,
    autoMsgPaymentOut: true,
    autoMsgSaleOrder: false,
    autoMsgPurchaseOrder: false,
    autoMsgEstimate: false,
    autoMsgProforma: false,
    autoMsgDeliveryChallan: false,
    autoMsgCancelledInvoice: false,
  },
  party: {
    partyGrouping: true,
    shippingAddress: true,
    printShippingAddress: false,
    managePartyStatus: true,
    paymentReminder: true,
    reminderDays: '7',
    enableLoyalty: false,
  },
  item: {
    enableItem: true,
    productService: 'Both',
    barcodeScan: true,
    stockMaintenance: true,
    manufacturing: false,
    lowStockDialog: true,
    itemUnits: 'Piece',
    unit: 'Pcs',
    itemCategory: true,
    partyWiseRate: false,
    description: true,
    itemWiseTax: true,
    itemWiseDiscount: true,
    wholesalePrice: true,
    updateSalePriceAuto: false,
    mrp: true,
    calculateTaxOnMRP: false,
    serialNumberTracking: false,
    batchTracking: false,
    expiryDate: false,
    manufacturingDate: false,
    modelNumber: false,
    size: true,
  },
  accounting: {
    enableAccounting: true,
    allowJournalEntries: true,
  },
  serviceReminders: {
    enableReminders: true,
    reminderInterval: '30',
    autoFollowUp: true,
  },
};

const cache = { settings: null, loading: false, listeners: new Set() };

const notifyListeners = () => {
  cache.listeners.forEach(fn => fn(cache.settings));
};

let loadPromise = null;

const loadSettings = async (force = false) => {
  if (cache.settings && !force) return cache.settings;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      cache.loading = true;
      const { data } = await settingAPI.get();
      cache.settings = data;
      notifyListeners();
      return data;
    } catch {
      const fallback = { preferences: JSON.parse(JSON.stringify(defaultPrefs)) };
      cache.settings = fallback;
      notifyListeners();
      return fallback;
    } finally {
      cache.loading = false;
      loadPromise = null;
    }
  })();
  return loadPromise;
};

const saveCategory = async (category, values) => {
  const prefs = cache.settings?.preferences || {};
  const updated = { ...prefs, [category]: { ...prefs[category], ...values } };
  const payload = { preferences: updated };
  try {
    const { data } = await settingAPI.update(payload);
    cache.settings = data;
    notifyListeners();
    return data;
  } catch (err) {
    throw err;
  }
};

const clearCache = () => {
  cache.settings = null;
  cache.loading = false;
  loadPromise = null;
};

export { defaultPrefs, loadSettings, saveCategory, clearCache };

const useSettings = () => {
  const [settings, setSettings] = useState(cache.settings);

  useEffect(() => {
    if (!cache.settings && !cache.loading) {
      loadSettings();
    }
    const listener = (s) => setSettings(s);
    cache.listeners.add(listener);
    if (cache.settings) setSettings(cache.settings);
    return () => cache.listeners.delete(listener);
  }, []);

  const getPref = useCallback((category, key) => {
    return settings?.preferences?.[category]?.[key] ?? defaultPrefs[category]?.[key];
  }, [settings]);

  const business = settings || {};
  const prefs = settings?.preferences || {};

  const reload = useCallback(async () => {
    cache.settings = null;
    return loadSettings(true);
  }, []);

  return { settings, business, prefs, getPref, loading: cache.loading, reload };
};

export { useSettings };
export default useSettings;
