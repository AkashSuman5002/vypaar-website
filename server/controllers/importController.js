const ImportHistory = require('../models/ImportHistory');
const GstRecord = require('../models/GstRecord');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const StockMovement = require('../models/StockMovement');
const Transaction = require('../models/Transaction');
const sqliteService = require('../services/sqliteService');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { recordStockMovement } = require('./stockController');
const { IMPORTS_DIR } = require('../config/paths');

const UPLOAD_DIR = IMPORTS_DIR;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CHUNK_SIZE = 500; // Process imports in batches of 500 rows

// ─── EXCEL IMPORT ────────────────────────────────────────────────────────────

const excelUpload = async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }
    const validTypes = ['Parties', 'Items', 'Sales', 'Purchases', 'Expenses', 'Stock'];
    const results = {};
    for (const file of files) {
      const type = validTypes.find(t => file.name?.toLowerCase().includes(t.toLowerCase()));
      if (!type) continue;
      const data = file.data || [];
      if (data.length === 0) {
        results[type] = { status: 'empty', rows: 0, columns: [], errors: [`${file.name} has no data`] };
        continue;
      }
      const columns = Object.keys(data[0] || {});
      const validation = validateExcelColumns(type, columns);
      results[type] = { status: validation.valid ? 'valid' : 'invalid', rows: data.length, columns, validation: validation.issues, preview: data.slice(0, 10) };
    }
    res.json({ message: 'Files analyzed', results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const validateExcelColumns = (type, columns) => {
  const requiredColumns = {
    Parties: ['Party Name', 'Mobile Number', 'GST Number'],
    Items: ['Item Name', 'Price', 'Stock'],
    Sales: ['Invoice No', 'Customer', 'Date', 'Total'],
    Purchases: ['Invoice No', 'Supplier', 'Date', 'Total'],
    Expenses: ['Date', 'Category', 'Amount'],
    Stock: ['Item Name', 'Quantity', 'Type'],
  };
  const issues = [];
  const expected = requiredColumns[type] || [];
  for (const col of expected) {
    const found = columns.some(c => c.toLowerCase().includes(col.toLowerCase()));
    if (!found) issues.push({ severity: 'error', message: `${col} column missing` });
  }
  return { valid: issues.length === 0, issues };
};

const excelColumnMapping = {
  Parties: { 'Party Name': 'name', 'Mobile Number': 'phone', 'GST Number': 'gstNumber', 'Address': 'address', 'Email': 'email', 'Opening Balance': 'openingBalance', 'Credit Limit': 'creditLimit' },
  Items: { 'Item Name': 'name', 'Category': 'category', 'Price': 'price', 'Stock': 'stock', 'GST Rate': 'gstRate', 'Unit': 'unit', 'HSN': 'hsn', 'Cost Price': 'costPrice', 'Description': 'description' },
  Sales: { 'Invoice No': 'invoiceNumber', 'Customer': 'customerName', 'Date': 'date', 'Total': 'totalAmount', 'Paid': 'paidAmount', 'Payment Method': 'paymentMethod', 'Items': 'items', 'Taxable': 'taxableAmount', 'CGST': 'cgstTotal', 'SGST': 'sgstTotal' },
  Purchases: { 'Invoice No': 'invoiceNumber', 'Supplier': 'supplierName', 'Date': 'date', 'Total': 'totalAmount', 'Paid': 'paidAmount', 'Payment Method': 'paymentMethod', 'Items': 'items' },
  Expenses: { 'Date': 'date', 'Category': 'category', 'Amount': 'amount', 'Description': 'description', 'Payment Method': 'paymentMethod' },
  Stock: { 'Item Name': 'productName', 'Quantity': 'quantity', 'Type': 'type', 'Date': 'date', 'Reference': 'reference' },
};

// Normalize a header for fuzzy matching: lowercase + strip every non-alphanumeric char.
// So "Sale Price", "sale_price", "Sale  Price" and "SALEPRICE" all become "saleprice".
const normHeader = (h) => String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, '');

// Per-type field -> accepted header aliases (already normalized). This is what fixes the
// "import brings in blank columns" bug for ALL types: real-world spreadsheets use many
// header spellings (Sale Price / Selling Price / MRP, Opening Stock / Qty, GST % / GST,
// Purchase / Cost, Barcode, etc.), and we now match any of them instead of one exact name.
const FIELD_ALIASES = {
  Parties: {
    name: ['partyname', 'name', 'customername', 'suppliername', 'party', 'companyname'],
    phone: ['mobilenumber', 'phone', 'mobile', 'contact', 'phoneno', 'mobileno', 'contactnumber', 'phonenumber'],
    gstNumber: ['gstnumber', 'gstin', 'gst', 'gstno'],
    address: ['address', 'addr', 'billingaddress'],
    email: ['email', 'emailaddress', 'mail', 'emailid'],
    openingBalance: ['openingbalance', 'balance', 'opening', 'openingbal', 'obal'],
    creditLimit: ['creditlimit', 'credit'],
    type: ['type', 'partytype'],
  },
  Items: {
    name: ['itemname', 'name', 'productname', 'item', 'product'],
    category: ['category', 'cat', 'group', 'itemcategory'],
    price: ['price', 'saleprice', 'sellingprice', 'mrp', 'rate', 'unitprice', 'salerate', 'sellprice', 'saleunitprice'],
    stock: ['stock', 'openingstock', 'qty', 'quantity', 'currentstock', 'openingqty', 'stockqty', 'openingquantity'],
    gstRate: ['gstrate', 'gst', 'gstpercent', 'tax', 'taxrate', 'gstpercentage'],
    unit: ['unit', 'uom', 'units'],
    hsn: ['hsn', 'hsncode', 'hsnsac', 'sac', 'hsnsaccode'],
    costPrice: ['costprice', 'purchase', 'purchaseprice', 'purchaserate', 'cost', 'buyprice', 'purchaseunitprice', 'purchasecost'],
    description: ['description', 'desc', 'remarks', 'notes'],
    barcode: ['barcode', 'itemcode', 'sku', 'code'],
    minStock: ['minstock', 'minimumstock', 'minstockalert', 'minimumstockalert', 'reorderlevel', 'lowstockalert', 'reorderpoint'],
    storageLocation: ['storagelocation', 'warehouse', 'location', 'godown', 'rack', 'shelf', 'bin'],
  },
  Sales: {
    invoiceNumber: ['invoiceno', 'invoicenumber', 'billno', 'billnumber', 'invoice', 'voucherno'],
    customerName: ['customer', 'customername', 'party', 'partyname', 'client', 'buyer'],
    date: ['date', 'invoicedate', 'billdate', 'saledate'],
    totalAmount: ['total', 'totalamount', 'grandtotal', 'amount', 'netamount', 'invoiceamount'],
    paidAmount: ['paid', 'paidamount', 'amountpaid', 'received', 'receivedamount'],
    paymentMethod: ['paymentmethod', 'paymentmode', 'mode', 'payment'],
    items: ['items', 'item', 'products', 'lineitems'],
    taxableAmount: ['taxable', 'taxableamount', 'taxablevalue'],
    cgstTotal: ['cgst', 'cgsttotal', 'cgstamount'],
    sgstTotal: ['sgst', 'sgsttotal', 'sgstamount'],
  },
  Purchases: {
    invoiceNumber: ['invoiceno', 'invoicenumber', 'billno', 'billnumber', 'invoice', 'purchaseno', 'voucherno'],
    supplierName: ['supplier', 'suppliername', 'party', 'partyname', 'vendor', 'vendorname'],
    date: ['date', 'invoicedate', 'billdate', 'purchasedate'],
    totalAmount: ['total', 'totalamount', 'grandtotal', 'amount', 'netamount'],
    paidAmount: ['paid', 'paidamount', 'amountpaid'],
    paymentMethod: ['paymentmethod', 'paymentmode', 'mode', 'payment'],
    items: ['items', 'item', 'products'],
  },
  Expenses: {
    date: ['date', 'expensedate'],
    category: ['category', 'cat', 'expensecategory', 'type', 'expensetype'],
    amount: ['amount', 'expenseamount', 'amt', 'total', 'totalamount'],
    description: ['description', 'desc', 'notes', 'remarks', 'narration'],
    paymentMethod: ['paymentmethod', 'paymentmode', 'mode', 'payment'],
  },
  Stock: {
    productName: ['itemname', 'name', 'productname', 'item', 'product'],
    quantity: ['quantity', 'qty', 'stock', 'units', 'currentstock', 'closingstock', 'availablestock'],
    type: ['type', 'movementtype', 'transactiontype', 'stocktype'],
    date: ['date', 'movementdate'],
    reference: ['reference', 'ref', 'remarks', 'notes'],
  },
};

// Build the { appField: value } object from a raw spreadsheet row by matching each field's
// aliases against the row's (normalized) headers. A user-supplied explicit mapping
// ({ 'Exact Header': 'appField' } from the UI's column-mapping step) takes precedence.
const mapRow = (row, type, userMapping) => {
  const mapped = {};
  // Index the row by normalized header once.
  const normRow = {};
  for (const key of Object.keys(row || {})) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') normRow[normHeader(key)] = v;
  }
  const aliases = FIELD_ALIASES[type] || {};
  for (const [field, names] of Object.entries(aliases)) {
    for (const n of names) {
      if (normRow[n] !== undefined) { mapped[field] = normRow[n]; break; }
    }
  }
  // Explicit user mapping wins over auto-detection.
  if (userMapping) {
    for (const [header, field] of Object.entries(userMapping)) {
      if (row && row[header] !== undefined && String(row[header]).trim() !== '') mapped[field] = row[header];
    }
  }
  return mapped;
};

const excelPreview = async (req, res) => {
  try {
    const { files, columnMapping } = req.body;
    if (!files) return res.status(400).json({ message: 'No data provided' });
    const summary = {};
    const previews = {};
    for (const file of files) {
      const type = file.type;
      const data = file.data || [];
      // Use the SAME alias-based mapping as the real import so the preview matches
      // exactly what will be imported (no more "preview looks empty" surprises).
      const mapped = data.map(row => mapRow(row, type, columnMapping && columnMapping[type]));
      summary[type] = data.length;
      previews[type] = mapped.slice(0, 10);
    }
    res.json({ summary, previews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const excelExecute = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { files, columnMapping, duplicateHandling, financialYear } = req.body;
    const mode = duplicateHandling || 'skip';
    const history = await ImportHistory.create({
      user: req.user._id, business: req.businessId, importType: 'excel', status: 'in_progress', duplicateHandling: mode, fileName: 'Excel Import', fileSize: 0, completedAt: null,
    });
    const results = { customers: 0, suppliers: 0, products: 0, sales: 0, purchases: 0, expenses: 0, stockMovements: 0, payments: 0, gstRecords: 0 };
    const errors = [];
    let totalFailed = 0;

    for (const file of files) {
      const type = file.type;
      const data = file.data || [];
      const mapping = columnMapping?.[type] || excelColumnMapping[type] || {};
      try {
        switch (type) {
          case 'Parties': {
            for (const row of data) {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              const doc = { user: req.user._id, business: req.businessId, name: mapped.name || '', phone: mapped.phone || '', gstNumber: mapped.gstNumber || '', address: mapped.address || '', email: mapped.email || '', openingBalance: parseFloat(mapped.openingBalance) || 0, creditLimit: parseFloat(mapped.creditLimit) || 0, isActive: true };
              const type = (mapped.type || 'Customer').toLowerCase();
              try {
                if (type === 'supplier') {
                  if (mode === 'skip') {
                    const exists = await Supplier.findOne({ ...baseFilter, name: doc.name });
                    if (!exists) { await Supplier.create(doc); results.suppliers++; }
                  } else if (mode === 'update') {
                    await Supplier.findOneAndUpdate({ ...baseFilter, name: doc.name }, doc, { upsert: true });
                    results.suppliers++;
                  } else {
                    await Supplier.create(doc); results.suppliers++;
                  }
                } else {
                  if (mode === 'skip') {
                    const exists = await Customer.findOne({ ...baseFilter, name: doc.name });
                    if (!exists) { await Customer.create(doc); results.customers++; }
                  } else if (mode === 'update') {
                    await Customer.findOneAndUpdate({ ...baseFilter, name: doc.name }, doc, { upsert: true });
                    results.customers++;
                  } else {
                    await Customer.create(doc); results.customers++;
                  }
                }
              } catch (e) { errors.push(`${type === 'supplier' ? 'Supplier' : 'Customer'} ${doc.name}: ${e.message}`); totalFailed++; }
            }
            break;
          }
          case 'Items': {
            const inserts = data.map(row => {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              return { user: req.user._id, business: req.businessId, name: mapped.name || '', category: mapped.category || '', price: parseFloat(mapped.price) || 0, costPrice: parseFloat(mapped.costPrice) || 0, stock: parseInt(mapped.stock) || 0, gstRate: parseInt(mapped.gstRate) || 0, unit: mapped.unit || 'Pcs', hsn: mapped.hsn || '', barcode: mapped.barcode ? String(mapped.barcode).trim() : '', minStock: parseInt(mapped.minStock) || 5, storageLocation: mapped.storageLocation ? String(mapped.storageLocation).trim() : '', description: mapped.description || '', isActive: true };
            });
            // Process in chunks for better performance
            for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
              const chunk = inserts.slice(i, i + CHUNK_SIZE);
              for (const doc of chunk) {
                try {
                  if (mode === 'skip') {
                    const exists = await Product.findOne({ ...baseFilter, name: doc.name });
                    if (!exists) { await Product.create(doc); results.products++; }
                  } else if (mode === 'update') {
                    await Product.findOneAndUpdate({ ...baseFilter, name: doc.name }, doc, { upsert: true });
                    results.products++;
                  } else {
                    await Product.create(doc); results.products++;
                  }
                } catch (e) { errors.push(`Product ${doc.name}: ${e.message}`); totalFailed++; }
              }
            }
            break;
          }
          case 'Sales': {
            for (const row of data) {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              try {
                const total = parseFloat(mapped.totalAmount) || 0;
                const paid = parseFloat(mapped.paidAmount) || 0;
                const cgst = parseFloat(mapped.cgstTotal) || 0;
                const sgst = parseFloat(mapped.sgstTotal) || 0;
                // The Excel Sales format carries no structured per-line columns
                // (only a free-text "Items" label plus row-level totals/tax).
                // Build ONE summary line item from the row totals so the invoice
                // is never empty, deriving the taxable base and a gstRate from the
                // CGST+SGST provided. Link the product by name/barcode when found.
                const itemName = (mapped.items && String(mapped.items).trim()) || mapped.customerName || 'Imported Item';
                const taxable = parseFloat(mapped.taxableAmount) || (total - cgst - sgst) || total;
                const taxTotal = cgst + sgst;
                const gstRate = taxable > 0 ? Math.round((taxTotal / taxable) * 100) : 0;
                const product = await Product.findOne({
                  ...baseFilter,
                  $or: [{ name: itemName }, { barcode: itemName }],
                });
                const item = {
                  product: product ? product._id : undefined,
                  productName: product ? product.name : itemName,
                  hsn: product ? product.hsn : '',
                  quantity: 1,
                  unit: product ? product.unit : 'Pcs',
                  rate: taxable,
                  amount: total,
                  gstRate,
                  taxableAmount: taxable,
                  cgst,
                  sgst,
                  igst: 0,
                };
                await Sale.create({ user: req.user._id, business: req.businessId, invoiceNumber: mapped.invoiceNumber || `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, customerName: mapped.customerName || 'Unknown', date: mapped.date || new Date(), items: [item], totalItems: 1, totalQuantity: 1, taxableAmount: taxable, cgstTotal: cgst, sgstTotal: sgst, taxTotal, totalAmount: total, paidAmount: paid, remainingBalance: Math.max(0, total - paid), paymentMethod: mapped.paymentMethod || 'cash', paymentStatus: total <= paid ? 'paid' : (paid > 0 ? 'partial' : 'unpaid') });
                results.sales++;
              } catch (e) { errors.push(`Sale ${mapped.invoiceNumber}: ${e.message}`); totalFailed++; }
            }
            break;
          }
          case 'Purchases': {
            for (const row of data) {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              try {
                const total = parseFloat(mapped.totalAmount) || 0;
                const paid = parseFloat(mapped.paidAmount) || 0;
                // The Excel Purchases format has no structured per-line or tax
                // columns (only a free-text "Items" label and row-level totals),
                // so build ONE summary line item from the total to keep the bill
                // non-empty. Treat the total as the taxable base (GST=0) since no
                // tax split is supplied; link the product by name/barcode if found.
                const itemName = (mapped.items && String(mapped.items).trim()) || 'Imported Item';
                const product = await Product.findOne({
                  ...baseFilter,
                  $or: [{ name: itemName }, { barcode: itemName }],
                });
                const item = {
                  product: product ? product._id : undefined,
                  productName: product ? product.name : itemName,
                  quantity: 1, // schema requires min 1
                  rate: total,
                  amount: total,
                  gstRate: 0,
                  taxableAmount: total,
                  cgst: 0,
                  sgst: 0,
                  igst: 0,
                };
                // Normalize paymentMethod to the Purchase enum [cash,bank,upi,cheque].
                const pmRaw = (mapped.paymentMethod || 'cash').toLowerCase();
                const pm = ['cash', 'bank', 'upi', 'cheque'].includes(pmRaw) ? pmRaw : 'cash';
                await Purchase.create({ user: req.user._id, business: req.businessId, supplierName: mapped.supplierName || 'Unknown', billNumber: mapped.invoiceNumber || `PUR-IMP-${Date.now()}`, date: mapped.date || new Date(), items: [item], taxableAmount: total, totalAmount: total, paidAmount: paid, remainingBalance: Math.max(0, total - paid), paymentMethod: pm, paymentStatus: total <= paid ? 'paid' : (paid > 0 ? 'partial' : 'unpaid') });
                results.purchases++;
              } catch (e) { errors.push(`Purchase ${mapped.invoiceNumber}: ${e.message}`); totalFailed++; }
            }
            break;
          }
          case 'Expenses': {
            for (const row of data) {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              try {
                // Transaction.type enum is [cash_in,cash_out,bank_in,bank_out];
                // an expense is money out — bank_out when paid by bank/cheque/card,
                // otherwise cash_out. (The model has no category/paymentMethod
                // fields, so fold the category into description.)
                const pm = (mapped.paymentMethod || 'cash').toLowerCase();
                const txnType = ['bank', 'cheque', 'card', 'upi', 'neft', 'rtgs'].some(k => pm.includes(k)) ? 'bank_out' : 'cash_out';
                const category = mapped.category || 'General';
                const desc = mapped.description ? `${category}: ${mapped.description}` : category;
                await Transaction.create({ user: req.user._id, business: req.businessId, type: txnType, amount: parseFloat(mapped.amount) || 0, description: desc, date: mapped.date || new Date(), partyType: 'expense', reference: 'Excel Import' });
                results.expenses++;
              } catch (e) { errors.push(`Expense: ${e.message}`); totalFailed++; }
            }
            break;
          }
          case 'Stock': {
            for (const row of data) {
              const mapped = mapRow(row, file.type, columnMapping && columnMapping[file.type]);
              try {
                const rawQty = parseInt(mapped.quantity) || 0;
                // Signed quantity: positive for "In", negative for "Out". The
                // StockMovement enum has no 'in'/'out'; use 'adjustment', which
                // recordStockMovement applies as a signed delta.
                const isOut = String(mapped.type || '').toLowerCase() === 'out';
                const qty = isOut ? -Math.abs(rawQty) : Math.abs(rawQty);
                // Resolve the product within the tenant by name (or barcode).
                const productName = mapped.productName || '';
                const product = await Product.findOne({
                  ...baseFilter,
                  $or: [{ name: productName }, { barcode: productName }],
                });
                if (!product) {
                  // Skip rows whose product can't be resolved; count as failed so
                  // it surfaces in the import report rather than crashing.
                  errors.push(`Stock ${productName}: product not found, skipped`);
                  totalFailed++;
                  continue;
                }
                // recordStockMovement looks up the product, computes
                // balanceBefore/balanceAfter and writes the ledger row with all
                // required fields. It does NOT persist Product.stock, so update it
                // here to match the recorded balance.
                const balanceAfter = await recordStockMovement({
                  userId: req.user._id,
                  businessId: req.businessId,
                  productId: product._id,
                  productName: product.name,
                  type: 'adjustment',
                  quantity: qty,
                  referenceType: 'import',
                  referenceNumber: mapped.reference || 'Excel Import',
                  description: 'Excel Import',
                });
                await Product.updateOne({ _id: product._id }, { $set: { stock: balanceAfter } });
                results.stockMovements++;
              } catch (e) { errors.push(`Stock ${mapped.productName}: ${e.message}`); totalFailed++; }
            }
            break;
          }
        }
      } catch (e) { errors.push(`${type}: ${e.message}`); totalFailed++; }
    }

    const totalRecords = Object.values(results).reduce((a, b) => a + b, 0);
    history.status = totalFailed > 0 && totalRecords > 0 ? 'partial' : totalFailed > 0 ? 'failed' : 'completed';
    history.summary = results;
    history.failedRecords = totalFailed;
    history.errorLog = errors.slice(0, 100);
    history.completedAt = new Date();
    await history.save();

    res.json({ message: 'Import completed', history, results, failed: totalFailed, errors: errors.slice(0, 20) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── VYAPAR BACKUP IMPORT ───────────────────────────────────────────────────

const backupUpload = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const uploadPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.backup', '.zip', '.db', '.sqlite', '.sqlite3'];
    if (!allowed.includes(ext)) {
      fs.unlinkSync(uploadPath);
      return res.status(400).json({ message: `Unsupported file format: ${ext}. Accepted: ${allowed.join(', ')}` });
    }
    const fileSize = req.file.size;
    let dbPath = uploadPath;

    // Detect ZIP by magic bytes (PK\x03\x04) regardless of extension
    const isZip = (() => {
      try {
        const fd = fs.openSync(uploadPath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        return buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
      } catch { return false; }
    })();

    if (isZip) {
      try {
        const zip = new AdmZip(uploadPath);
        const entries = zip.getEntries();
        // Try matching by extension (case-insensitive)
        let dbEntry = entries.find(e => {
          const name = e.entryName.toLowerCase();
          return name.endsWith('.db') || name.endsWith('.sqlite') ||
                 name.endsWith('.sqlite3') || name.endsWith('.backup') ||
                 name.endsWith('.sqlite2');
        });
        // Fallback: check each entry's magic bytes for SQLite format
        if (!dbEntry) {
          for (const entry of entries) {
            try {
              const data = zip.readFile(entry);
              if (data && data.length > 15 &&
                  data[0] === 0x53 && data[1] === 0x51 &&
                  data[2] === 0x4C && data[3] === 0x69 &&
                  data[4] === 0x74 && data[5] === 0x65) {
                dbEntry = entry;
                break;
              }
            } catch { /* skip unreadable entries */ }
          }
        }
        if (!dbEntry) {
          fs.unlinkSync(uploadPath);
          return res.status(400).json({ message: 'No database file found in archive' });
        }
        const extractDir = path.join(UPLOAD_DIR, `extracted-${req.user._id}-${Date.now()}`);
        if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
        zip.extractEntryTo(dbEntry, extractDir, false, true);
        dbPath = path.join(extractDir, dbEntry.entryName);
      } catch (e) {
        fs.unlinkSync(uploadPath);
        return res.status(400).json({ message: `Failed to extract archive: ${e.message}` });
      }
    }

    let tables = [];
    let rowCounts = {};
    let version = 'Unknown';
    let backupDate = null;
    let dbType = 'Unknown';

    await sqliteService.waitForInit();
    if (sqliteService.isSqlJsAvailable()) {
      try {
        const sql = sqliteService.openDatabase(dbPath);
        if (sql) {
          tables = sqliteService.getTables(sql);
          rowCounts = sqliteService.getRowCounts(sql, tables);
          version = sqliteService.getSetting(sql, 'version') || 'Unknown';
          backupDate = sqliteService.getSetting(sql, 'backup_date') || null;
          dbType = 'SQLite';
          sql.close();
        }
      } catch (e) {
        dbType = 'Unreadable';
      }
    } else {
      const stats = fs.statSync(dbPath);
      dbType = 'SQLite (estimated)';
      if (stats.size > 0) {
        tables = ['parties', 'items', 'sales', 'purchases', 'expenses', 'stock', 'payments', 'gst_records', 'settings', 'company'];
        rowCounts = { parties: 0, items: 0, sales: 0, purchases: 0, expenses: 0, stock: 0, payments: 0, gst_records: 0 };
      }
    }

    const history = await ImportHistory.create({
      user: req.user._id, business: req.businessId, importType: 'vyapar_backup', status: 'in_progress',
      fileName: req.file.originalname, fileSize, uploadPath: dbPath,
      vyaparVersion: version, completedAt: null,
    });

    res.json({ message: 'Backup uploaded', historyId: history._id, version, dbType, backupDate, tables, rowCounts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const backupAnalyze = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { historyId } = req.params;
    const history = await ImportHistory.findOne({ _id: historyId, ...getBaseFilter(req) });
    if (!history) return res.status(404).json({ message: 'Import history not found' });

    const detected = { customers: 0, suppliers: 0, products: 0, sales: 0, purchases: 0, expenses: 0, stock: 0, payments: 0, gstRecords: 0 };

    if (!history.uploadPath || !fs.existsSync(history.uploadPath)) {
      return res.status(422).json({ message: 'Could not read backup file: the uploaded backup is missing on the server' });
    }
    await sqliteService.waitForInit();
    if (!sqliteService.isSqlJsAvailable()) {
      return res.status(422).json({ message: 'Could not read backup file: SQLite reader is unavailable on the server' });
    }

    let sql;
    try {
      sql = sqliteService.openDatabase(history.uploadPath);
    } catch (e) {
      return res.status(422).json({ message: `Could not read backup file: ${e.message}` });
    }
    if (!sql) {
      return res.status(422).json({ message: 'Could not read backup file: unsupported or corrupt backup' });
    }

    try {
      const tables = sqliteService.getTables(sql);
      const tableMap = {
        customers: ['parties', 'customers', 'party'],
        suppliers: ['suppliers', 'supplier'],
        products: ['items', 'products', 'item'],
        sales: ['sales', 'sale', 'invoice'],
        purchases: ['purchases', 'purchase'],
        expenses: ['expenses', 'expense'],
        stock: ['stock', 'stock_movements', 'inventory'],
        payments: ['payments', 'payment'],
        gstRecords: ['gst_records', 'gst', 'gst_record'],
      };
      for (const [key, candidates] of Object.entries(tableMap)) {
        const match = tables.find(t => candidates.some(c => t.toLowerCase() === c));
        if (match) {
          const countRes = sql.exec(`SELECT COUNT(*) as cnt FROM "${match}";`);
          if (countRes.length > 0) detected[key] = countRes[0].values[0][0];
        }
      }
    } finally {
      sql.close();
    }

    res.json({
      version: history.vyaparVersion || 'Unknown',
      fileSize: history.fileSize,
      backupDate: history.createdAt,
      detected,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const upsertEntity = async (Model, query, doc, mode) => {
  if (mode === 'skip') {
    const exists = await Model.findOne(query);
    if (!exists) { await Model.create(doc); return true; }
    return false;
  } else if (mode === 'update') {
    await Model.findOneAndUpdate(query, doc, { upsert: true });
    return true;
  } else {
    await Model.create(doc);
    return true;
  }
};

const backupExecute = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { historyId, selectedTables, duplicateHandling } = req.body;
    const mode = duplicateHandling || 'skip';
    const history = await ImportHistory.findOne({ _id: historyId, ...getBaseFilter(req) });
    if (!history) return res.status(404).json({ message: 'Import not found' });

    const results = { customers: 0, suppliers: 0, products: 0, sales: 0, purchases: 0, expenses: 0, stockMovements: 0, payments: 0, gstRecords: 0 };
    const errors = [];
    let totalFailed = 0;

    if (!history.uploadPath || !fs.existsSync(history.uploadPath)) {
      return res.status(422).json({ message: 'Could not read backup file: the uploaded backup is missing on the server' });
    }
    await sqliteService.waitForInit();
    if (!sqliteService.isSqlJsAvailable()) {
      return res.status(422).json({ message: 'Could not read backup file: SQLite reader is unavailable on the server' });
    }

    {
      let sql;
      try {
        sql = sqliteService.openDatabase(history.uploadPath);
      } catch (e) {
        return res.status(422).json({ message: `Could not read backup file: ${e.message}` });
      }
      if (!sql) {
        return res.status(422).json({ message: 'Could not read backup file: unsupported or corrupt backup' });
      }
      try {
        const tables = sqliteService.getTables(sql);

        const tableMap = {
          customers: { candidates: ['parties', 'customers', 'party'], fn: (r) => {
            const entity = r;
            return { user: req.user._id, business: req.businessId, name: entity.name || entity.party_name || entity.customer_name || entity.partyName || 'Unknown', phone: entity.phone || entity.mobile || '', gstNumber: entity.gstin || entity.gst_number || entity.gstNumber || '', address: entity.address || '', email: entity.email || '' };
          }, queryFn: (r) => {
            const name = r.name || r.party_name || r.customer_name || r.partyName || 'Unknown';
            return { ...baseFilter, name };
          }, model: Customer, resultsKey: 'customers' },
          products: { candidates: ['items', 'products', 'item'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, name: r.name || r.item_name || r.product_name || r.itemName || 'Unknown', price: parseFloat(r.price || r.sale_price || r.selling_price) || 0, costPrice: parseFloat(r.cost_price || r.costPrice || r.purchase_price) || 0, stock: parseInt(r.stock || r.quantity || r.current_stock) || 0, gstRate: parseInt(r.gst_rate || r.gstRate || r.gst) || 0, unit: r.unit || 'Pcs', hsn: r.hsn || '', isActive: true };
          }, queryFn: (r) => {
            const name = r.name || r.item_name || r.product_name || r.itemName || 'Unknown';
            return { ...baseFilter, name };
          }, model: Product, resultsKey: 'products' },
          sales: { candidates: ['sales', 'sale', 'invoice'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, invoiceNumber: r.invoice_no || r.invoice_number || r.invoiceNumber || `VI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, customerName: r.customer_name || r.party_name || r.customerName || 'Unknown', date: r.date || r.invoice_date || new Date(), items: [], taxableAmount: parseFloat(r.taxable_amount || r.taxableAmount || r.taxable) || 0, cgstTotal: parseFloat(r.cgst_total || r.cgstTotal || r.cgst) || 0, sgstTotal: parseFloat(r.sgst_total || r.sgstTotal || r.sgst) || 0, totalAmount: parseFloat(r.total || r.total_amount || r.grand_total || r.totalAmount) || 0, paidAmount: parseFloat(r.paid || r.paid_amount || r.paidAmount) || 0, remainingBalance: parseFloat(r.balance || r.due || r.remaining || r.remainingBalance) || 0, paymentStatus: 'unpaid', paymentMethod: (r.payment_method || r.paymentMode || 'cash').toLowerCase() };
          }, queryFn: (r) => {
            const inv = r.invoice_no || r.invoice_number || r.invoiceNumber || 'Unknown';
            return { ...baseFilter, invoiceNumber: inv };
          }, model: Sale, resultsKey: 'sales' },
          purchases: { candidates: ['purchases', 'purchase'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, invoiceNumber: r.invoice_no || r.invoice_number || r.invoiceNumber || r.bill_no || `PI-${Date.now()}`, supplierName: r.supplier_name || r.party_name || r.supplierName || 'Unknown', date: r.date || r.purchase_date || new Date(), items: [], totalAmount: parseFloat(r.total || r.total_amount || r.totalAmount) || 0, paidAmount: parseFloat(r.paid || r.paid_amount || r.paidAmount) || 0, remainingBalance: parseFloat(r.balance || r.due || r.remainingBalance) || 0, paymentStatus: 'unpaid' };
          }, queryFn: (r) => {
            const inv = r.invoice_no || r.invoice_number || r.invoiceNumber || r.bill_no || 'Unknown';
            return { ...baseFilter, invoiceNumber: inv };
          }, model: Purchase, resultsKey: 'purchases' },
          expenses: { candidates: ['expenses', 'expense'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, type: 'cash_out', category: r.category || r.expense_category || 'General', amount: parseFloat(r.amount || r.expense_amount) || 0, description: r.description || r.note || '', date: r.date || r.expense_date || new Date() };
          }, queryFn: (r) => null, model: Transaction, resultsKey: 'expenses' },
          stockMovements: { candidates: ['stock', 'stock_movements', 'inventory'], fn: (r) => {
            const qty = parseInt(r.quantity || r.qty || r.stock) || 0;
            return { user: req.user._id, business: req.businessId, productName: r.item_name || r.product_name || r.itemName || 'Unknown', type: (r.type === 'in' || r.type === 'IN' || r.type === 'purchase') ? 'purchase' : 'sale', quantity: qty, balanceBefore: 0, balanceAfter: qty, date: r.date || r.movement_date || new Date(), referenceType: 'import', referenceNumber: r.reference || '', description: 'Vyapar Import' };
          }, queryFn: (r) => null, model: StockMovement, resultsKey: 'stockMovements' },
          payments: { candidates: ['payments', 'payment'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, type: r.type === 'in' || r.type === 'IN' ? 'cash_in' : 'cash_out', amount: parseFloat(r.amount || r.paid_amount || r.payment_amount) || 0, description: r.description || r.note || 'Payment import', date: r.date || r.payment_date || new Date(), partyName: r.party_name || r.customer_name || r.supplier_name || '', reference: 'Vyapar Import' };
          }, queryFn: (r) => null, model: Transaction, resultsKey: 'payments' },
          gstRecords: { candidates: ['gst_records', 'gst', 'gst_record'], fn: (r) => {
            return { user: req.user._id, business: req.businessId, partyName: r.party_name || r.customer_name || r.supplier_name || r.partyName || '', partyGstin: r.gstin || r.gst_number || r.gstNumber || r.party_gstin || '', invoiceNumber: r.invoice_no || r.invoice_number || r.invoiceNumber || '', invoiceDate: r.date || r.invoice_date || new Date(), invoiceType: r.type || r.invoice_type || '', taxableValue: parseFloat(r.taxable_value || r.taxableValue || r.taxable_amount || r.taxableAmount || 0), cgst: parseFloat(r.cgst || r.cgst_amount || 0), sgst: parseFloat(r.sgst || r.sgst_amount || 0), igst: parseFloat(r.igst || r.igst_amount || 0), cess: parseFloat(r.cess || r.cess_amount || 0), totalTax: parseFloat(r.total_tax || r.totalTax || r.tax_amount || 0), totalAmount: parseFloat(r.total || r.total_amount || r.totalAmount || 0), placeOfSupply: r.place_of_supply || r.placeOfSupply || '', isInterState: !!(r.is_inter_state || r.isInterState), reverseCharge: !!(r.reverse_charge || r.reverseCharge), eWayBillNo: r.eway_bill_no || r.eWayBillNo || '', importRef: history._id };
          }, queryFn: (r) => null, model: GstRecord, resultsKey: 'gstRecords' },
        };

        for (const [key, config] of Object.entries(tableMap)) {
          if (selectedTables && !selectedTables.includes(key)) continue;
          const match = tables.find(t => config.candidates.some(c => t.toLowerCase() === c));
          if (!match) { errors.push(`Table for ${key} not found in backup`); continue; }
          try {
            const records = sqliteService.extractRowsAsObjects(sql, match);
            for (const record of records) {
              try {
                const doc = config.fn(record);
                const query = config.queryFn ? config.queryFn(record) : null;
                let inserted = true;
                if (query) {
                  inserted = await upsertEntity(config.model, query, doc, mode);
                } else {
                  await config.model.create(doc);
                }
                if (inserted) results[config.resultsKey]++;
              } catch (e) { errors.push(`${key}: ${e.message}`); totalFailed++; }
            }
          } catch (e) { errors.push(`Table ${match}: ${e.message}`); totalFailed++; }
        }
      } catch (e) {
        return res.status(422).json({ message: `Could not read backup file: ${e.message}` });
      } finally {
        sql.close();
      }
    }

    const totalRecords = Object.values(results).reduce((a, b) => a + b, 0);
    history.status = totalFailed > 0 && totalRecords > 0 ? 'partial' : totalFailed > 0 ? 'failed' : 'completed';
    history.summary = results;
    history.failedRecords = totalFailed;
    history.errorLog = errors.slice(0, 100);
    history.completedAt = new Date();
    await history.save();

    res.json({ message: 'Import completed', history, results, failed: totalFailed, errors: errors.slice(0, 20) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── IMPORT HISTORY ─────────────────────────────────────────────────────────

const getHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const histories = await ImportHistory.find({ ...baseFilter }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await ImportHistory.countDocuments({ ...baseFilter });
    res.json({ histories, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getHistoryById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ImportHistory.findOne({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Import history not found' });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ImportHistory.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Import history not found' });
    res.json({ message: 'Import history deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getHistoryLog = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ImportHistory.findOne({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Import history not found' });
    const log = [
      `Import Type: ${history.importType}`,
      `Status: ${history.status}`,
      `Date: ${history.createdAt}`,
      `Completed: ${history.completedAt || 'N/A'}`,
      `Duplicate Handling: ${history.duplicateHandling}`,
      `File: ${history.fileName || 'N/A'}`,
      `Vyapar Version: ${history.vyaparVersion || 'N/A'}`,
      '',
      '--- Summary ---',
      `Customers: ${history.summary.customers}`,
      `Suppliers: ${history.summary.suppliers}`,
      `Products: ${history.summary.products}`,
      `Sales: ${history.summary.sales}`,
      `Purchases: ${history.summary.purchases}`,
      `Expenses: ${history.summary.expenses}`,
      `Stock Movements: ${history.summary.stockMovements}`,
      `Payments: ${history.summary.payments}`,
      `GST Records: ${history.summary.gstRecords}`,
      '',
      `Failed Records: ${history.failedRecords}`,
      '',
      '--- Errors ---',
      ...(history.errorLog || []),
    ];
    const content = log.join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=import-${history._id}.log`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  excelUpload, excelPreview, excelExecute,
  backupUpload, backupAnalyze, backupExecute,
  getHistory, getHistoryById, deleteHistory, getHistoryLog,
};
