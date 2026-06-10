const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const PDFDocument = require('pdfkit');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const StockMovement = require('../models/StockMovement');
const Transaction = require('../models/Transaction');
const GstRecord = require('../models/GstRecord');
const Setting = require('../models/Setting');
const ExportHistory = require('../models/ExportHistory');
const { getBaseFilter, getCreateData, getSettingQuery } = require('../utils/queryHelper');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

const getRecordCounts = async (baseFilter) => {
  const [customers, suppliers, products, sales, purchases, expenses, stockMovements, payments, gstRecords] = await Promise.all([
    Customer.countDocuments({ ...baseFilter }),
    Supplier.countDocuments({ ...baseFilter }),
    Product.countDocuments({ ...baseFilter }),
    Sale.countDocuments({ ...baseFilter }),
    Purchase.countDocuments({ ...baseFilter }),
    Transaction.countDocuments({ ...baseFilter, type: 'expense' }),
    StockMovement.countDocuments({ ...baseFilter }),
    Transaction.countDocuments({ ...baseFilter, type: { $in: ['cash_in', 'cash_out'] } }),
    GstRecord.countDocuments({ ...baseFilter }),
  ]);
  return { customers, suppliers, products, sales, purchases, expenses, stockMovements, payments, gstRecords };
};

const getCounts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const counts = await getRecordCounts(baseFilter);
    res.json(counts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const excelExport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { modules, dateFrom, dateTo, format } = req.body;
    if (!modules || modules.length === 0) {
      return res.status(400).json({ message: 'Select at least one module to export' });
    }

    const userId = req.user._id;
    const workbook = XLSX.utils.book_new();
    const results = {};

    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    for (const mod of modules) {
      let data = [];
      let worksheet;
      switch (mod) {
        case 'Parties': {
          const customers = await Customer.find({ ...baseFilter }).lean();
          const suppliers = await Supplier.find({ ...baseFilter }).lean();
          data = [
            ...customers.map(c => ({ Type: 'Customer', Name: c.name, Phone: c.phone, 'GST Number': c.gstNumber, Address: c.address, Email: c.email, 'Opening Balance': c.openingBalance, 'Credit Limit': c.creditLimit, Active: c.isActive ? 'Yes' : 'No', Created: c.createdAt })),
            ...suppliers.map(s => ({ Type: 'Supplier', Name: s.name, Phone: s.phone, 'GST Number': s.gstNumber, Address: s.address, Email: s.email, 'Opening Balance': s.openingBalance, Active: s.isActive ? 'Yes' : 'No', Created: s.createdAt })),
          ];
          results[mod] = data.length;
          break;
        }
        case 'Items': {
          const products = await Product.find({ ...baseFilter }).lean();
          data = products.map(p => ({ Name: p.name, Category: p.category, Price: p.price, 'Cost Price': p.costPrice, Stock: p.stock, 'GST Rate': p.gstRate, Unit: p.unit, HSN: p.hsn, Active: p.isActive ? 'Yes' : 'No' }));
          results[mod] = data.length;
          break;
        }
        case 'Sales': {
          const query = { ...baseFilter };
          if (dateFrom || dateTo) query.date = dateFilter;
          const sales = await Sale.find(query).lean();
          data = sales.map(s => ({ 'Invoice No': s.invoiceNumber, Customer: s.customerName, Date: s.date, 'Total Amount': s.totalAmount, Paid: s.paidAmount, Balance: s.remainingBalance, 'Payment Method': s.paymentMethod, Status: s.paymentStatus }));
          results[mod] = data.length;
          break;
        }
        case 'Purchases': {
          const query = { ...baseFilter };
          if (dateFrom || dateTo) query.date = dateFilter;
          const purchases = await Purchase.find(query).lean();
          data = purchases.map(p => ({ 'Invoice No': p.invoiceNumber, Supplier: p.supplierName, Date: p.date, 'Total Amount': p.totalAmount, Paid: p.paidAmount, Balance: p.remainingBalance, 'Payment Method': p.paymentMethod }));
          results[mod] = data.length;
          break;
        }
        case 'Expenses': {
          const query = { ...baseFilter, type: 'expense' };
          if (dateFrom || dateTo) query.date = dateFilter;
          const expenses = await Transaction.find(query).lean();
          data = expenses.map(e => ({ Date: e.date, Category: e.category, Amount: e.amount, Description: e.description, 'Payment Method': e.paymentMethod }));
          results[mod] = data.length;
          break;
        }
        case 'Stock': {
          const query = { ...baseFilter };
          if (dateFrom || dateTo) query.date = dateFilter;
          const movements = await StockMovement.find(query).lean();
          data = movements.map(m => ({ 'Product Name': m.productName, Type: m.type, Quantity: m.quantity, Date: m.date, Reference: m.referenceNumber }));
          results[mod] = data.length;
          break;
        }
        case 'Customer Ledger': {
          const customers = await Customer.find({ ...baseFilter }).lean();
          const customerNames = customers.map(c => c.name);
          const allSales = customerNames.length > 0 ? await Sale.find({ ...baseFilter, customerName: { $in: customerNames } }).lean() : [];
          const salesByCustomer = {};
          for (const s of allSales) {
            if (!salesByCustomer[s.customerName]) salesByCustomer[s.customerName] = [];
            salesByCustomer[s.customerName].push(s);
          }
          for (const c of customers) {
            for (const s of (salesByCustomer[c.name] || [])) {
              data.push({ Customer: c.name, Type: 'Sale', 'Invoice No': s.invoiceNumber, Date: s.date, Amount: s.totalAmount, Paid: s.paidAmount, Balance: s.remainingBalance });
            }
          }
          results[mod] = data.length;
          break;
        }
        case 'Supplier Ledger': {
          const suppliers = await Supplier.find({ ...baseFilter }).lean();
          const supplierNames = suppliers.map(s => s.name);
          const allPurchases = supplierNames.length > 0 ? await Purchase.find({ ...baseFilter, supplierName: { $in: supplierNames } }).lean() : [];
          const purchasesBySupplier = {};
          for (const p of allPurchases) {
            if (!purchasesBySupplier[p.supplierName]) purchasesBySupplier[p.supplierName] = [];
            purchasesBySupplier[p.supplierName].push(p);
          }
          for (const s of suppliers) {
            for (const p of (purchasesBySupplier[s.name] || [])) {
              data.push({ Supplier: s.name, Type: 'Purchase', 'Invoice No': p.invoiceNumber, Date: p.date, Amount: p.totalAmount, Paid: p.paidAmount, Balance: p.remainingBalance });
            }
          }
          results[mod] = data.length;
          break;
        }
        case 'Cash Transactions': {
          const query = { ...baseFilter, type: { $in: ['cash_in', 'cash_out'] } };
          if (dateFrom || dateTo) query.date = dateFilter;
          const txns = await Transaction.find(query).lean();
          data = txns.map(t => ({ Date: t.date, Type: t.type === 'cash_in' ? 'Cash In' : 'Cash Out', Amount: t.amount, Description: t.description, Party: t.partyName || '' }));
          results[mod] = data.length;
          break;
        }
        case 'Bank Transactions': {
          const query = { ...baseFilter, type: { $in: ['bank_in', 'bank_out', 'bank_transfer'] } };
          if (dateFrom || dateTo) query.date = dateFilter;
          const txns = await Transaction.find(query).lean();
          data = txns.map(t => ({ Date: t.date, Type: t.type, Amount: t.amount, Description: t.description }));
          results[mod] = data.length;
          break;
        }
        case 'GST Data': {
          const query = { ...baseFilter };
          if (dateFrom || dateTo) query.invoiceDate = dateFilter;
          const gst = await GstRecord.find(query).lean();
          data = gst.map(g => ({ 'Party Name': g.partyName, 'Party GSTIN': g.partyGstin, 'Invoice No': g.invoiceNumber, Date: g.invoiceDate, Type: g.invoiceType, 'Taxable Value': g.taxableValue, CGST: g.cgst, SGST: g.sgst, IGST: g.igst, Cess: g.cess, 'Total Tax': g.totalTax, 'Total Amount': g.totalAmount, 'Place of Supply': g.placeOfSupply, 'Is Inter-State': g.isInterState ? 'Yes' : 'No', 'Reverse Charge': g.reverseCharge ? 'Yes' : 'No', 'E-Way Bill': g.eWayBillNo }));
          results[mod] = data.length;
          break;
        }
      }
      if (data.length > 0) {
        worksheet = XLSX.utils.json_to_sheet(data);
        const colWidths = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length, 20) }));
        worksheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, worksheet, mod.substring(0, 31));
      }
    }

    if (format === 'zip') {
      const zip = new AdmZip();
      const tmpDir = path.join(EXPORT_DIR, `tmp-${req.user._id}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const sheets = workbook.SheetNames;
      for (const name of sheets) {
        const ws = workbook.Sheets[name];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, name);
        const filePath = path.join(tmpDir, `${name}.xlsx`);
        XLSX.writeFile(wb, filePath);
        zip.addLocalFile(filePath);
      }
      const zipPath = path.join(EXPORT_DIR, `excel-export-${req.user._id}-${Date.now()}.zip`);
      zip.writeZip(zipPath);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      await ExportHistory.create({ user: req.user._id, business: req.businessId, exportType: 'excel', status: 'completed', summary: { customers: results.Parties || 0, products: results.Items || 0, sales: results.Sales || 0, purchases: results.Purchases || 0, expenses: results.Expenses || 0, stockMovements: results.Stock || 0, payments: (results['Cash Transactions'] || 0) + (results['Bank Transactions'] || 0), gstRecords: results['GST Data'] || 0 }, fileName: `excel-export.zip`, fileSize: fs.statSync(zipPath).size, filePath: zipPath, format: 'zip', modules, filters: { dateFrom, dateTo }, completedAt: new Date() });
      res.download(zipPath, `excel-export.zip`, (err) => { if (err) console.error('Download error:', err); fs.unlink(zipPath, () => {}); });
    } else {
      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const fileName = `export-${Date.now()}${ext}`;
      const filePath = path.join(EXPORT_DIR, fileName);
      if (format === 'csv') {
        const sheets = workbook.SheetNames;
        if (sheets.length === 1) {
          XLSX.writeFile(workbook, filePath, { bookType: 'csv' });
        } else {
          const zip = new AdmZip();
          const tmpDir = path.join(EXPORT_DIR, `tmp-${req.user._id}-${Date.now()}`);
          fs.mkdirSync(tmpDir, { recursive: true });
          for (const name of sheets) {
            const ws = workbook.Sheets[name];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, name);
            const csvPath = path.join(tmpDir, `${name}.csv`);
            XLSX.writeFile(wb, csvPath, { bookType: 'csv' });
            zip.addLocalFile(csvPath);
          }
          const zipPath = path.join(EXPORT_DIR, `csv-export-${req.user._id}-${Date.now()}.zip`);
          zip.writeZip(zipPath);
          fs.rmSync(tmpDir, { recursive: true, force: true });
          const total = Object.values(results).reduce((a, b) => a + b, 0);
          await ExportHistory.create({ user: req.user._id, business: req.businessId, exportType: 'excel', status: 'completed', fileName: `csv-export.zip`, fileSize: fs.statSync(zipPath).size, filePath: zipPath, format: 'zip', modules, filters: { dateFrom, dateTo }, completedAt: new Date() });
          return res.download(zipPath, `csv-export.zip`, (err) => { if (err) console.error('Download error:', err); fs.unlink(zipPath, () => {}); });
        }
      } else {
        XLSX.writeFile(workbook, filePath);
      }
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      await ExportHistory.create({ user: req.user._id, business: req.businessId, exportType: 'excel', status: 'completed', summary: { customers: results.Parties || 0, products: results.Items || 0, sales: results.Sales || 0, purchases: results.Purchases || 0, expenses: results.Expenses || 0, stockMovements: results.Stock || 0 }, fileName, fileSize: fs.statSync(filePath).size, filePath, format, modules, filters: { dateFrom, dateTo }, completedAt: new Date() });
      res.download(filePath, fileName, (err) => { if (err) console.error('Download error:', err); fs.unlink(filePath, () => {}); });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const backupExport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = req.user._id;
    const tmpDir = path.join(EXPORT_DIR, `backup-${userId}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const [customers, suppliers, products, sales, purchases, expenses, stockMovements, payments, gstRecords, settings] = await Promise.all([
      Customer.find({ ...baseFilter }).lean(),
      Supplier.find({ ...baseFilter }).lean(),
      Product.find({ ...baseFilter }).lean(),
      Sale.find({ ...baseFilter }).lean(),
      Purchase.find({ ...baseFilter }).lean(),
      Transaction.find({ ...baseFilter, type: 'expense' }).lean(),
      StockMovement.find({ ...baseFilter }).lean(),
      Transaction.find({ ...baseFilter, type: { $in: ['cash_in', 'cash_out'] } }).lean(),
      GstRecord.find({ ...baseFilter }).lean(),
      Setting.findOne(getSettingQuery(req)).lean(),
    ]);

    const sanitize = (arr) => arr.map(item => {
      const { _id, __v, user, password, ...rest } = item;
      return rest;
    });

    fs.writeFileSync(path.join(tmpDir, 'customers.json'), JSON.stringify(sanitize(customers), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'suppliers.json'), JSON.stringify(sanitize(suppliers), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'products.json'), JSON.stringify(sanitize(products), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'sales.json'), JSON.stringify(sanitize(sales), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'purchases.json'), JSON.stringify(sanitize(purchases), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'expenses.json'), JSON.stringify(sanitize(expenses), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'stock.json'), JSON.stringify(sanitize(stockMovements), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'payments.json'), JSON.stringify(sanitize(payments), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'gst.json'), JSON.stringify(sanitize(gstRecords), null, 2));
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(settings ? sanitize([settings])[0] : {}, null, 2));

    const metadata = {
      businessName: settings?.businessName || 'Unknown',
      createdDate: new Date().toISOString(),
      appVersion: '1.0.0',
      databaseVersion: '1.0',
      recordCounts: {
        customers: customers.length, suppliers: suppliers.length, products: products.length,
        sales: sales.length, purchases: purchases.length, expenses: expenses.length,
        stockMovements: stockMovements.length, payments: payments.length, gstRecords: gstRecords.length,
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'backup-info.json'), JSON.stringify(metadata, null, 2));

    const zip = new AdmZip();
    zip.addLocalFolder(tmpDir);
    const zipPath = path.join(EXPORT_DIR, `backup-${userId}-${Date.now()}.zip`);
    zip.writeZip(zipPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    await ExportHistory.create({
      user: userId, business: req.businessId, exportType: 'backup', status: 'completed',
      summary: { customers: customers.length, suppliers: suppliers.length, products: products.length, sales: sales.length, purchases: purchases.length, expenses: expenses.length, stockMovements: stockMovements.length, payments: payments.length, gstRecords: gstRecords.length },
      fileName: 'backup.zip', fileSize: fs.statSync(zipPath).size, filePath: zipPath, format: 'zip', completedAt: new Date(),
    });

    res.download(zipPath, 'backup.zip', (err) => { if (err) console.error('Download error:', err); fs.unlink(zipPath, () => {}); });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reportExport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { reportType, format, dateFrom, dateTo } = req.body;
    const userId = req.user._id;

    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    let data = [];
    let title = '';

    switch (reportType) {
      case 'Profit & Loss': {
        title = 'Profit & Loss Statement';
        const sales = await Sale.find({ ...baseFilter, ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        const purchases = await Purchase.find({ ...baseFilter, ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        const expenses = await Transaction.find({ ...baseFilter, type: 'expense', ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        const totalSales = sales.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalPurchases = purchases.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        data = [
          { Particulars: 'Total Sales', Amount: totalSales },
          { Particulars: 'Total Purchases', Amount: -totalPurchases },
          { Particulars: 'Gross Profit', Amount: totalSales - totalPurchases },
          { Particulars: 'Total Expenses', Amount: -totalExpenses },
          { Particulars: 'Net Profit/Loss', Amount: totalSales - totalPurchases - totalExpenses },
        ];
        break;
      }
      case 'Balance Sheet': {
        title = 'Balance Sheet';
        const sales = await Sale.find({ ...baseFilter }).lean();
        const purchases = await Purchase.find({ ...baseFilter }).lean();
        const customers = await Customer.find({ ...baseFilter }).lean();
        const suppliers = await Supplier.find({ ...baseFilter }).lean();
        const totalReceivables = sales.reduce((s, inv) => s + (inv.remainingBalance || 0), 0);
        const totalPayables = purchases.reduce((s, inv) => s + (inv.remainingBalance || 0), 0);
        data = [
          { Particulars: 'Assets', Amount: '' },
          { Particulars: 'Accounts Receivable', Amount: totalReceivables },
          { Particulars: 'Liabilities', Amount: '' },
          { Particulars: 'Accounts Payable', Amount: totalPayables },
          { Particulars: 'Net Worth', Amount: totalReceivables - totalPayables },
        ];
        break;
      }
      case 'Trial Balance': {
        title = 'Trial Balance';
        const sales = await Sale.find({ ...baseFilter }).lean();
        const purchases = await Purchase.find({ ...baseFilter }).lean();
        const expenses = await Transaction.find({ ...baseFilter, type: 'expense' }).lean();
        const customers = await Customer.find({ ...baseFilter }).lean();
        const totalSales = sales.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalPurchases = purchases.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        data = [
          { Account: 'Sales', 'Debit': 0, 'Credit': totalSales },
          { Account: 'Purchases', 'Debit': totalPurchases, 'Credit': 0 },
          { Account: 'Expenses', 'Debit': totalExpenses, 'Credit': 0 },
          { Account: 'Customers (Receivables)', 'Debit': sales.reduce((s, inv) => s + (inv.remainingBalance || 0), 0), 'Credit': 0 },
          { Account: 'Suppliers (Payables)', 'Debit': 0, 'Credit': purchases.reduce((s, inv) => s + (inv.remainingBalance || 0), 0) },
        ];
        break;
      }
      case 'Cash Flow': {
        title = 'Cash Flow Statement';
        const cashIn = await Transaction.find({ ...baseFilter, type: 'cash_in', ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        const cashOut = await Transaction.find({ ...baseFilter, type: 'cash_out', ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        const totalIn = cashIn.reduce((s, t) => s + (t.amount || 0), 0);
        const totalOut = cashOut.reduce((s, t) => s + (t.amount || 0), 0);
        data = [
          { Category: 'Cash Inflow', Amount: totalIn },
          { Category: 'Cash Outflow', Amount: -totalOut },
          { Category: 'Net Cash Flow', Amount: totalIn - totalOut },
        ];
        break;
      }
      case 'GST Reports': {
        title = 'GST Report';
        const gst = await GstRecord.find({ ...baseFilter, ...(dateFrom || dateTo ? { invoiceDate: dateFilter } : {}) }).lean();
        data = gst.map(g => ({ 'Party Name': g.partyName, 'GSTIN': g.partyGstin, 'Invoice No': g.invoiceNumber, 'Taxable Value': g.taxableValue, CGST: g.cgst, SGST: g.sgst, IGST: g.igst, 'Total Tax': g.totalTax }));
        break;
      }
      case 'Party Reports': {
        title = 'Party Report';
        const customers = await Customer.find({ ...baseFilter }).lean();
        const customerNames = customers.map(c => c.name);
        const allPartySales = customerNames.length > 0 ? await Sale.find({ ...baseFilter, customerName: { $in: customerNames } }).lean() : [];
        const salesByCustomer = {};
        for (const s of allPartySales) {
          if (!salesByCustomer[s.customerName]) salesByCustomer[s.customerName] = [];
          salesByCustomer[s.customerName].push(s);
        }
        for (const c of customers) {
          const partySales = salesByCustomer[c.name] || [];
          const total = partySales.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
          data.push({ 'Party Name': c.name, Type: 'Customer', Phone: c.phone, 'Total Sales': total, Balance: partySales.reduce((s, inv) => s + (inv.remainingBalance || 0), 0) });
        }
        break;
      }
      case 'Stock Reports': {
        title = 'Stock Report';
        const products = await Product.find({ ...baseFilter }).lean();
        data = products.map(p => ({ 'Product Name': p.name, Category: p.category, 'Current Stock': p.stock, Price: p.price, 'Stock Value': (p.stock || 0) * (p.costPrice || 0) }));
        break;
      }
      case 'Business Reports': {
        title = 'Business Overview';
        const allSales = await Sale.find({ ...baseFilter }).lean();
        const allPurchases = await Purchase.find({ ...baseFilter }).lean();
        const totalSales = allSales.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalPurchases = allPurchases.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        data = [
          { Metric: 'Total Sales', Value: totalSales },
          { Metric: 'Total Purchases', Value: totalPurchases },
          { Metric: 'Net', Value: totalSales - totalPurchases },
          { Metric: 'Sales Count', Value: allSales.length },
          { Metric: 'Purchase Count', Value: allPurchases.length },
        ];
        break;
      }
      case 'Expense Reports': {
        title = 'Expense Report';
        const expenses = await Transaction.find({ ...baseFilter, type: 'expense', ...(dateFrom || dateTo ? { date: dateFilter } : {}) }).lean();
        data = expenses.map(e => ({ Date: e.date, Category: e.category, Amount: e.amount, Description: e.description }));
        break;
      }
    }

    const fileName = `${reportType.replace(/\s+/g, '_')}-${Date.now()}`;
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const filePath = path.join(EXPORT_DIR, `${fileName}.pdf`);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown();
      if (dateFrom || dateTo) {
        doc.fontSize(10).text(`Period: ${dateFrom || 'Start'} to ${dateTo || 'End'}`, { align: 'center' });
        doc.moveDown();
      }
      doc.moveDown();
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const colWidth = 500 / headers.length;
        doc.fontSize(9).font('Helvetica-Bold');
        let y = doc.y;
        headers.forEach((h, i) => doc.text(h, 30 + i * colWidth, y, { width: colWidth }));
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(8);
        data.forEach(row => {
          y = doc.y;
          if (y > 750) { doc.addPage(); y = doc.y; }
          headers.forEach((h, i) => doc.text(String(row[h] ?? ''), 30 + i * colWidth, y, { width: colWidth }));
          doc.moveDown(0.3);
        });
      }
      doc.end();
      await new Promise(resolve => stream.on('finish', resolve));
      await ExportHistory.create({ user: req.user._id, business: req.businessId, exportType: 'report', status: 'completed', fileName: `${fileName}.pdf`, fileSize: fs.statSync(filePath).size, filePath, format: 'pdf', modules: [reportType], filters: { dateFrom, dateTo }, completedAt: new Date() });
      res.download(filePath, `${fileName}.pdf`, (err) => { if (err) console.error('Download error:', err); fs.unlink(filePath, () => {}); });
    } else {
      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const outPath = path.join(EXPORT_DIR, `${fileName}${ext}`);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, reportType.substring(0, 31));
      XLSX.writeFile(wb, outPath);
      await ExportHistory.create({ user: req.user._id, business: req.businessId, exportType: 'report', status: 'completed', fileName: `${fileName}${ext}`, fileSize: fs.statSync(outPath).size, filePath: outPath, format, modules: [reportType], filters: { dateFrom, dateTo }, completedAt: new Date() });
      res.download(outPath, `${fileName}${ext}`, (err) => { if (err) console.error('Download error:', err); fs.unlink(outPath, () => {}); });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const histories = await ExportHistory.find({ ...baseFilter }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await ExportHistory.countDocuments({ ...baseFilter });
    res.json({ histories, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getHistoryById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ExportHistory.findOne({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Export history not found' });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ExportHistory.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Export history not found' });
    if (history.filePath && fs.existsSync(history.filePath)) {
      fs.unlink(history.filePath, () => {});
    }
    res.json({ message: 'Export history deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const history = await ExportHistory.findOne({ _id: req.params.id, ...baseFilter });
    if (!history) return res.status(404).json({ message: 'Export history not found' });
    if (!history.filePath || !fs.existsSync(history.filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    res.download(history.filePath, history.fileName, (err) => {
      if (err) console.error('Download error:', err);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCounts, excelExport, backupExport, reportExport,
  getHistory, getHistoryById, deleteHistory, downloadHistory,
};
