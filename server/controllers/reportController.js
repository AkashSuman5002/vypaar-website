const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const StockMovement = require('../models/StockMovement');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const Expense = require('../models/Expense');
const PurchaseReturn = require('../models/PurchaseReturn');
const GstRecord = require('../models/GstRecord');
const Godown = require('../models/Godown');
const mongoose = require('mongoose');
const { getBaseFilter, getSettingQuery } = require('../utils/queryHelper');
const {
  isB2B,
  buildDayBookEntries,
  bankStatementRows,
  bankAccountNeedles,
  transactionMatchesAccount,
  buildProfitLossLineItems,
  stockValueAsOf,
  agingBucket,
  buildHsnSummary,
  reconcileStock,
  computeTdsTcs,
  buildGodownStock,
} = require('../utils/reportHelpers');

// getBaseFilter returns ids that Model.find() auto-casts, but aggregation $match
// does not — build an explicitly-cast copy for use inside aggregate pipelines.
const toAggBase = (baseFilter) => {
  const toId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v));
  const out = {};
  if (baseFilter.business !== undefined) out.business = toId(baseFilter.business);
  if (baseFilter.user !== undefined) out.user = toId(baseFilter.user);
  return out;
};

// Frontend report pages are inconsistent: some send `dateFrom`/`dateTo`, others
// send `startDate`/`endDate`. Normalize both onto `req.query.startDate`/`endDate`
// so every handler below (which reads startDate/endDate) honours the date range.
const normalizeDateQuery = (req) => {
  if (!req || !req.query) return;
  const q = req.query;
  if (q.startDate == null && q.dateFrom != null) q.startDate = q.dateFrom;
  if (q.endDate == null && q.dateTo != null) q.endDate = q.dateTo;
};

const getSalesReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('customer', 'name phone');

    const summary = sales.reduce(
      (acc, s) => {
        acc.totalAmount += s.totalAmount;
        acc.paidAmount += s.paidAmount;
        acc.balance += s.remainingBalance;
        return acc;
      },
      { totalAmount: 0, paidAmount: 0, balance: 0 }
    );

    res.json({ sales, summary, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPurchaseReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const total = await Purchase.countDocuments(filter);
    const purchases = await Purchase.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('supplier', 'name phone');

    const summary = purchases.reduce(
      (acc, p) => {
        acc.totalAmount += p.totalAmount;
        acc.paidAmount += p.paidAmount;
        acc.balance += p.remainingBalance;
        return acc;
      },
      { totalAmount: 0, paidAmount: 0, balance: 0 }
    );

    res.json({ purchases, summary, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProfitReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const sales = await Sale.find({ ...filter, type: 'invoice' }).lean();
    const creditNotes = await Sale.find({ ...filter, type: 'credit_note' }).lean();
    const debitNotes = await Purchase.find({ ...filter, type: 'debit_note' }).lean();
    const purchases = await Purchase.find(filter).lean();
    const products = await Product.find({ ...baseFilter }).lean();
    const expenses = await Expense.find({ ...baseFilter }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const totalGST = sales.reduce((s, sale) => s + (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0), 0);
    const purchaseGST = purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0);

    const totalSales = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalCreditNotes = creditNotes.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalDebitNotes = debitNotes.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    // Fix 10: expenses include their tax (totalAmount = amount + tax), matching the
    // accounting-view P&L so the two figures agree.
    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || e.amount || 0), 0);
    const netSales = totalSales - totalGST;

    let totalCOGS = 0;
    sales.forEach((s) => {
      (s.items || []).forEach((item) => {
        let unitCost = item.costPrice || 0;
        if (!unitCost && item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) unitCost = prod.costPrice || prod.purchasePrice || 0;
        }
        totalCOGS += unitCost * (item.quantity || 0);
      });
    });

    const grossProfit = netSales - totalCOGS;

    // Opening & closing stock are derived by replaying the StockMovement ledger:
    // stock as of a date = currentStock - (net signed movements after that date).
    // Opening = value at the period start; closing = value at the period end. With no
    // date range both fall back to the current inventory value. Valued at current cost
    // (costPrice), consistent with the closing figure.
    const aggBase = toAggBase(baseFilter);
    const movedAfter = async (cutoff) => {
      const rows = await StockMovement.aggregate([
        { $match: { ...aggBase, date: { $gt: cutoff } } },
        { $group: { _id: '$product', moved: { $sum: '$quantity' } } },
      ]);
      const m = {};
      rows.forEach((r) => { if (r._id) m[r._id.toString()] = r.moved; });
      return m;
    };

    let openingStock = 0;
    let closingStock = stockValueAsOf(products, {}); // current inventory value
    if (startDate) {
      // Opening is the value at the START of startDate, i.e. exclude movements on/after it.
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const startCutoff = new Date(start.getTime() - 1);
      openingStock = stockValueAsOf(products, await movedAfter(startCutoff));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      closingStock = stockValueAsOf(products, await movedAfter(end));
    }

    // Categorize expenses into direct vs indirect, keeping each bucket's own
    // line items separate (so the Direct/Indirect sections don't show the same list).
    const expenseBreakdown = {
      directExpenses: 0,
      indirectExpenses: 0,
      directItems: [],
      indirectItems: [],
    };
    expenses.forEach((e) => {
      const cat = (e.category || 'other').toLowerCase();
      const amt = e.totalAmount || e.amount || 0;
      const item = { name: e.description || e.category || 'Expense', amount: amt };
      if (cat.includes('direct') || cat.includes('manufactur') || cat.includes('petrol') || cat.includes('discount')) {
        expenseBreakdown.directExpenses += amt;
        expenseBreakdown.directItems.push(item);
      } else {
        expenseBreakdown.indirectExpenses += amt;
        expenseBreakdown.indirectItems.push(item);
      }
    });

    // Build the Vyapar-style P&L so the line items reconcile to Gross/Net Profit.
    // Gross/Net Profit are derived FROM these same rows (sale - purchase ± stock -
    // direct expenses - net tax), not from a separate COGS formula, so the breakdown
    // always sums to the totals shown. COGS is still returned for reference.
    const { lineItems, grossProfit: reconciledGrossProfit, netProfit } = buildProfitLossLineItems({
      totalSales,
      totalCreditNotes,
      totalPurchases,
      totalDebitNotes,
      directExpenses: expenseBreakdown.directExpenses,
      indirectExpenses: expenseBreakdown.indirectExpenses,
      directItems: expenseBreakdown.directItems,
      indirectItems: expenseBreakdown.indirectItems,
      totalGST,
      purchaseGST,
      openingStock,
      closingStock,
    });

    res.json({
      totalSales,
      totalPurchases,
      totalCOGS,
      cogsGrossProfit: grossProfit,
      grossProfit: reconciledGrossProfit,
      totalGST,
      purchaseGST,
      totalExpenses,
      netProfit,
      openingStock,
      closingStock,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      lineItems,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getGSTReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const sales = await Sale.find({ ...filter, type: 'invoice' });
    const purchases = await Purchase.find(filter);

    // GST summary by rate
    const gstByRate = {};

    const addGST = (items, type) => {
      items.forEach((item) => {
        const rate = item.gstRate || 0;
        if (!gstByRate[rate]) {
          gstByRate[rate] = { rate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
        }
        gstByRate[rate].taxableAmount += item.taxableAmount || 0;
        gstByRate[rate].cgst += item.cgst || 0;
        gstByRate[rate].sgst += item.sgst || 0;
        gstByRate[rate].igst += item.igst || 0;
        gstByRate[rate].count += 1;
      });
    };

    sales.forEach((s) => addGST(s.items, 'sale'));
    purchases.forEach((p) => addGST(p.items, 'purchase'));

    const gstSummary = Object.values(gstByRate).sort((a, b) => a.rate - b.rate);
    const totalOutputGST = sales.reduce((s, sale) => s + (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0), 0);
    const totalInputGST = purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0);

    res.json({
      gstSummary,
      totalOutputGST,
      totalInputGST,
      netGSTLiability: totalOutputGST - totalInputGST,
      totalSales: sales.length,
      totalPurchases: purchases.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getGSTR1 = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const sales = await Sale.find(filter).sort({ date: -1 }).populate('customer', 'name gstNumber');

    // B2B requires a registered customer with a GSTIN; everything else is B2C.
    const b2b = sales.filter((s) => isB2B(s.customer));
    const b2c = sales.filter((s) => !isB2B(s.customer));

    const summary = {
      totalInvoices: sales.length,
      totalTaxable: sales.reduce((s, sale) => s + (sale.taxableAmount || 0), 0),
      totalGST: sales.reduce((s, sale) => s + (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0), 0),
      b2bCount: b2b.length,
      b2cCount: b2c.length,
    };

    res.json({ invoices: sales, b2b, b2c, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getGSTR3B = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate required' });
    }
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const filter = { ...baseFilter, date: { $gte: new Date(startDate), $lt: end } };

    const sales = await Sale.find({ ...filter, type: 'invoice' });
    const purchases = await Purchase.find(filter);

    // 3.1 Supply details — use the ACTUAL stored CGST/SGST/IGST totals per document
    // instead of fabricating a 50/50 central/state split that ignores inter-state IGST.
    const taxableValue = sales.reduce((s, sale) => s + (sale.taxableAmount || 0), 0);
    const supplyCentralTax = sales.reduce((s, sale) => s + (sale.cgstTotal || 0), 0);
    const supplyStateTax = sales.reduce((s, sale) => s + (sale.sgstTotal || 0), 0);
    const supplyIntegratedTax = sales.reduce((s, sale) => s + (sale.igstTotal || 0), 0);
    const supplyCess = sales.reduce((s, sale) => s + (sale.cessTotal || 0), 0);
    const totalGST = supplyCentralTax + supplyStateTax + supplyIntegratedTax;

    // 4. ITC — likewise use the real purchase tax totals (Purchase has no cess field).
    const itcValue = purchases.reduce((s, p) => s + (p.taxableAmount || 0), 0);
    const itcCentralTax = purchases.reduce((s, p) => s + (p.cgstTotal || 0), 0);
    const itcStateTax = purchases.reduce((s, p) => s + (p.sgstTotal || 0), 0);
    const itcIntegratedTax = purchases.reduce((s, p) => s + (p.igstTotal || 0), 0);
    const itcGST = itcCentralTax + itcStateTax + itcIntegratedTax;

    res.json({
      gstr3b: {
        supply: {
          taxableValue,
          centralTax: supplyCentralTax,
          stateTax: supplyStateTax,
          integratedTax: supplyIntegratedTax,
          cess: supplyCess,
        },
        itc: {
          eligible: itcValue,
          centralTax: itcCentralTax,
          stateTax: itcStateTax,
          integratedTax: itcIntegratedTax,
        },
        netGSTPayable: totalGST - itcGST,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// #41 GSTR-9: Parts II–IV are computed from REAL recorded data — outward supplies
// (B2B/B2C rate-wise), reverse-charge outward supplies (Sale.reverseCharge flag),
// credit notes (incl. cess), advances, ITC availed/reversed, and outward tax are
// all aggregated from the tenant's Sale/Purchase/PurchaseReturn/Transaction
// documents for the chosen financial year.
// LIMITATION: A handful of fields cannot be sourced from the current data model and
// are left at 0 rather than fabricated — SEZ supplies, deemed exports, outward debit
// notes, cess on purchases/purchase-returns, and ineligible-ITC classification (no
// flags/fields exist for these). The response `unsourcedFields` array lists each one
// so a 0 is never mistaken for a verified nil. They will populate once the
// underlying data captures those distinctions.
const getGSTR9Report = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { financialYear } = req.query;

    let startDate, endDate;
    if (financialYear) {
      const year = parseInt(financialYear);
      startDate = new Date(`${year}-04-01`);
      endDate = new Date(`${year + 1}-03-31T23:59:59.999Z`);
    } else {
      const now = new Date();
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      startDate = new Date(`${fyStart}-04-01`);
      endDate = new Date(`${fyStart + 1}-03-31T23:59:59.999Z`);
    }

    const dateFilter = { date: { $gte: startDate, $lte: endDate } };
    const fyLabel = `${startDate.getFullYear()}-${endDate.getFullYear()}`;

    const [sales, creditNotes, debitNotesList, purchases, purchaseReturns, transactions] = await Promise.all([
      Sale.find({ ...baseFilter, ...dateFilter, type: 'invoice' }).lean(),
      Sale.find({ ...baseFilter, ...dateFilter, type: 'credit_note' }).lean(),
      Sale.find({ ...baseFilter, ...dateFilter, type: 'debit_note' }).lean(),
      Purchase.find({ ...baseFilter, ...dateFilter }).lean(),
      PurchaseReturn.find({ ...baseFilter, returnDate: { $gte: startDate, $lte: endDate } }).lean(),
      Transaction.find({ ...baseFilter, date: { $gte: startDate, $lte: endDate } }).lean(),
    ]);

    // Helper
    const total = (arr, field) => arr.reduce((s, x) => s + (x[field] || 0), 0);

    // ── PART II: Outward Supplies ──────────────────────────────
    const b2b = sales.filter(s => s.customer && s.customerGst);
    const b2c = sales.filter(s => !s.customer || !s.customerGst || s.customerName === 'Walk-in');
    const exportsData = sales.filter(s => s.gstSupplyType === 'export'
      || (s.placeOfSupply || '').toLowerCase().includes('outside')
      || (s.placeOfSupply || '').toLowerCase().includes('export'));
    const sezData = sales.filter(s => s.gstSupplyType === 'sez');
    const deemedExports = sales.filter(s => s.gstSupplyType === 'deemed_export');

    const rateBuckets = (list) => {
      const rates = {};
      for (const inv of list) {
        for (const item of (inv.items || [])) {
          const r = item.gstRate ?? 0;
          if (!rates[r]) rates[r] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
          rates[r].taxableValue += item.taxableAmount || 0;
          rates[r].cgst += item.cgst || 0;
          rates[r].sgst += item.sgst || 0;
          rates[r].igst += item.igst || 0;
          rates[r].cess += item.cess || 0;
        }
      }
      return Object.entries(rates).map(([rate, v]) => ({ rate: Number(rate), ...v }));
    };

    const rateWiseB2B = rateBuckets(b2b);
    const rateWiseB2C = rateBuckets(b2c);

    const cnTotal = {
      taxableValue: total(creditNotes, 'taxableAmount'),
      cgst: total(creditNotes, 'cgstTotal'),
      sgst: total(creditNotes, 'sgstTotal'),
      igst: total(creditNotes, 'igstTotal'),
      cess: total(creditNotes, 'cessTotal'),
    };
    const dnTotal = {
      taxableValue: total(debitNotesList, 'taxableAmount'),
      cgst: total(debitNotesList, 'cgstTotal'),
      sgst: total(debitNotesList, 'sgstTotal'),
      igst: total(debitNotesList, 'igstTotal'),
      cess: total(debitNotesList, 'cessTotal'),
    };

    // Advances from Transactions (prepaid/received advances)
    const advances = transactions.filter(t => t.type === 'payment' && t.paymentMode === 'advance');
    const advancesTotal = { taxableValue: total(advances, 'amount') || 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };

    // Outward supplies on which tax is payable under reverse charge (Table 4G):
    // Sale carries a real `reverseCharge` flag, so this CAN be sourced.
    const reverseChargeSales = sales.filter(s => s.reverseCharge === true);
    const reverseChargeTotal = {
      count: reverseChargeSales.length,
      taxableValue: total(reverseChargeSales, 'taxableAmount'),
      cgst: total(reverseChargeSales, 'cgstTotal'),
      sgst: total(reverseChargeSales, 'sgstTotal'),
      igst: total(reverseChargeSales, 'igstTotal'),
      cess: total(reverseChargeSales, 'cessTotal'),
    };

    const part2 = {
      rateWiseB2B,
      rateWiseB2C,
      exports: { taxableValue: total(exportsData, 'taxableAmount'), cgst: total(exportsData, 'cgstTotal'), sgst: total(exportsData, 'sgstTotal'), igst: total(exportsData, 'igstTotal'), cess: total(exportsData, 'cessTotal') },
      // SEZ supplies & deemed exports sourced from Sale.gstSupplyType.
      sezSupplies: { taxableValue: total(sezData, 'taxableAmount'), cgst: total(sezData, 'cgstTotal'), sgst: total(sezData, 'sgstTotal'), igst: total(sezData, 'igstTotal'), cess: total(sezData, 'cessTotal') },
      deemedExports: { taxableValue: total(deemedExports, 'taxableAmount'), cgst: total(deemedExports, 'cgstTotal'), sgst: total(deemedExports, 'sgstTotal'), igst: total(deemedExports, 'igstTotal'), cess: total(deemedExports, 'cessTotal') },
      reverseChargeOutward: reverseChargeTotal,
      creditNotes: { count: creditNotes.length, ...cnTotal },
      // Outward debit notes sourced from Sale.type === 'debit_note'.
      debitNotes: { count: debitNotesList.length, ...dnTotal },
      advances: advancesTotal,
      adjustments: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 },
    };

    // ── PART III: Input Tax Credit ────────────────────────────
    // Eligible ITC excludes Sec.17(5) blocked purchases; those are disclosed separately.
    const eligiblePurchases = purchases.filter(p => !p.ineligibleITC);
    const blockedPurchases = purchases.filter(p => p.ineligibleITC);
    const itcAvailed = {
      cgst: total(eligiblePurchases, 'cgstTotal'),
      sgst: total(eligiblePurchases, 'sgstTotal'),
      igst: total(eligiblePurchases, 'igstTotal'),
      cess: total(eligiblePurchases, 'cessTotal'),
    };
    const itcReversed = {
      cgst: total(purchaseReturns, 'cgstTotal'),
      sgst: total(purchaseReturns, 'sgstTotal'),
      igst: total(purchaseReturns, 'igstTotal'),
      cess: total(purchaseReturns, 'cessTotal'),
    };
    const netITC = {
      cgst: Math.max(0, itcAvailed.cgst - itcReversed.cgst),
      sgst: Math.max(0, itcAvailed.sgst - itcReversed.sgst),
      igst: Math.max(0, itcAvailed.igst - itcReversed.igst),
      cess: Math.max(0, itcAvailed.cess - itcReversed.cess),
    };
    const ineligibleITC = {
      cgst: total(blockedPurchases, 'cgstTotal'),
      sgst: total(blockedPurchases, 'sgstTotal'),
      igst: total(blockedPurchases, 'igstTotal'),
      cess: total(blockedPurchases, 'cessTotal'),
    };

    const part3 = {
      itcAvailed: { ...itcAvailed, total: itcAvailed.cgst + itcAvailed.sgst + itcAvailed.igst + itcAvailed.cess },
      itcReversed: { ...itcReversed, total: itcReversed.cgst + itcReversed.sgst + itcReversed.igst + itcReversed.cess },
      netITC: { ...netITC, total: netITC.cgst + netITC.sgst + netITC.igst + netITC.cess },
      ineligibleITC: { ...ineligibleITC, total: ineligibleITC.cgst + ineligibleITC.sgst + ineligibleITC.igst + ineligibleITC.cess },
    };

    // ── PART IV: Tax Paid ────────────────────────────────────
    const outwardTax = {
      cgst: total(sales, 'cgstTotal') - cnTotal.cgst,
      sgst: total(sales, 'sgstTotal') - cnTotal.sgst,
      igst: total(sales, 'igstTotal') - cnTotal.igst,
      cess: total(sales, 'cessTotal') - cnTotal.cess,
    };
    const part4 = {
      taxPaid: {
        cgst: Math.max(0, outwardTax.cgst),
        sgst: Math.max(0, outwardTax.sgst),
        igst: Math.max(0, outwardTax.igst),
        cess: Math.max(0, outwardTax.cess),
        total: Math.max(0, outwardTax.cgst) + Math.max(0, outwardTax.sgst) + Math.max(0, outwardTax.igst) + Math.max(0, outwardTax.cess),
      },
    };

    // ── PART V: Previous Year Adjustments ────────────────────
    const part5 = {
      amendments: { count: 0, taxableValue: 0 },
      creditNotes: { count: creditNotes.length, taxableValue: cnTotal.taxableValue },
      debitNotes: { count: 0, taxableValue: 0 },
    };

    // ── PART VI: Other Information ────────────────────────────
    const refundTxns = transactions.filter(t => t.type === 'refund');
    const lateFeeTxns = transactions.filter(t => t.description && /late fee/i.test(t.description));
    const part6 = {
      refundClaimed: total(refundTxns, 'amount'),
      demandRaised: 0,
      demandPaid: 0,
      lateFees: total(lateFeeTxns, 'amount'),
      interestPaid: 0,
    };

    // ── Summary ────────────────────────────────────────────────
    const taxableTurnover = total(sales, 'taxableAmount');
    const totalGSTCollected = total(sales, 'cgstTotal') + total(sales, 'sgstTotal') + total(sales, 'igstTotal') + total(sales, 'cessTotal');
    const totalITCClaimed = part3.netITC.total;
    const netGSTLiability = Math.max(0, totalGSTCollected - cnTotal.cgst - cnTotal.sgst - cnTotal.igst - cnTotal.cess - totalITCClaimed);

    res.json({
      financialYear: fyLabel,
      summary: { taxableTurnover, totalGSTCollected, totalITCClaimed, netGSTLiability },
      part2,
      part3,
      part4,
      part5,
      part6,
      meta: { totalSales: sales.length, totalPurchases: purchases.length, totalCreditNotes: creditNotes.length },
      // Fields kept at 0 because the current data model captures no source for them.
      // Returned explicitly so consumers don't mistake 0 for a verified nil value.
      // SEZ/deemed exports, outward debit notes, ITC cess and Sec.17(5) ineligible ITC
      // are now sourced from the data model (Sale.gstSupplyType / type='debit_note',
      // Purchase.cessTotal / ineligibleITC, PurchaseReturn.cessTotal). They populate
      // once transactions carry those values; historical rows default to regular/0/false.
      unsourcedFields: [
        { field: 'part6.demandRaised/demandPaid/interestPaid', reason: 'No demand/interest records in the data model' },
      ],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHSNSummary = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter, type: 'invoice' };
    const sales = await Sale.find(filter);

    // Grouped by HSN + rate + UQC (unit), with the rate and per-head tax shown, as
    // the GST portal's HSN summary requires.
    res.json({ hsnSummary: buildHsnSummary(sales) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPartyReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { partyType = 'customer' } = req.query;
    const filter = { ...baseFilter };

    if (partyType === 'customer') {
      const customers = await Customer.find(filter);
      const sales = await Sale.find({ ...filter, type: 'invoice' });

      const report = customers.map((c) => {
        const partySales = sales.filter((s) => String(s.customer) === String(c._id));
        const totalSales = partySales.reduce((s, sale) => s + sale.totalAmount, 0);
        const totalPaid = partySales.reduce((s, sale) => s + sale.paidAmount, 0);
        return {
          _id: c._id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          totalSales,
          totalPaid,
          outstanding: totalSales - totalPaid + (c.openingBalance || 0),
          invoiceCount: partySales.length,
        };
      });

      res.json({ parties: report });
    } else {
      const suppliers = await Supplier.find(filter);
      const purchases = await Purchase.find(filter);

      const report = suppliers.map((s) => {
        const partyPurchases = purchases.filter((p) => String(p.supplier) === String(s._id));
        const totalPurchases = partyPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const totalPaid = partyPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        return {
          _id: s._id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          totalPurchases,
          totalPaid,
          outstanding: totalPurchases - totalPaid + (s.openingBalance || 0),
          billCount: partyPurchases.length,
        };
      });

      res.json({ parties: report });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCashFlow = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const Setting = require('../models/Setting');
    const userSetting = await Setting.findOne(getSettingQuery(req));
    const defaultStart = userSetting?.accountBooksBeginningDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      else filter.date.$gte = new Date(defaultStart);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    } else {
      filter.date = { $gte: new Date(defaultStart) };
    }

    const transactions = await Transaction.find(filter).sort({ date: -1 });

    const cashIn = transactions.filter((t) => t.type === 'cash_in' || t.type === 'bank_in');
    const cashOut = transactions.filter((t) => t.type === 'cash_out' || t.type === 'bank_out');

    const totalIn = cashIn.reduce((s, t) => s + t.amount, 0);
    const totalOut = cashOut.reduce((s, t) => s + t.amount, 0);

    res.json({
      transactions,
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut,
      cashInCount: cashIn.length,
      cashOutCount: cashOut.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDayBook = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    // Cash/bank movements (these capture every actual money in/out, including the
    // received/paid portion of invoices, bills, expenses and manual payments).
    const transactions = await Transaction.find(filter).lean();
    const cashRows = transactions.map((t) => {
      const isIn = t.type?.includes('in');
      return {
        _id: t._id,
        date: t.date,
        voucher: t.reference || '-',
        particular: t.description || '-',
        moneyIn: isIn ? t.amount : 0,
        moneyOut: isIn ? 0 : t.amount,
        type: t.type,
      };
    });

    // Credit (unpaid) sales/purchases so the voucher itself appears in the Day Book
    // even when no cash changed hands. These carry no money in/out, so they never
    // distort the running cash balance.
    const saleFilter = { ...filter, type: 'invoice', remainingBalance: { $gt: 0 } };
    const purchaseFilter = { ...filter, remainingBalance: { $gt: 0 } };
    const [creditSales, creditPurchases] = await Promise.all([
      Sale.find(saleFilter).select('date invoiceNumber customerName remainingBalance').lean(),
      Purchase.find(purchaseFilter).select('date billNumber supplierName remainingBalance').lean(),
    ]);
    const creditRows = [
      ...creditSales.map((s) => ({
        date: s.date,
        voucher: s.invoiceNumber || '-',
        particular: `Credit Sale - ${s.customerName || 'Party'}`,
        type: 'credit_sale',
        dueAmount: s.remainingBalance || 0,
      })),
      ...creditPurchases.map((p) => ({
        date: p.date,
        voucher: p.billNumber || '-',
        particular: `Credit Purchase - ${p.supplierName || 'Party'}`,
        type: 'credit_purchase',
        dueAmount: p.remainingBalance || 0,
      })),
    ];

    const entries = buildDayBookEntries(cashRows, creditRows);

    res.json({ entries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getOutstandingReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter, type: 'invoice' };
    const sales = await Sale.find({ ...filter, remainingBalance: { $gt: 0 } })
      .sort({ date: -1 })
      .populate('customer', 'name phone');

    const aging = {
      '0-30': [], '31-60': [], '61-90': [], '90+': [],
    };
    const now = new Date();

    // Age by the due date (fall back to invoice date when no credit terms were set),
    // so "days overdue" reflects when payment was actually due, not when invoiced.
    sales.forEach((s) => {
      const refDate = s.dueDate || s.date;
      const daysDiff = Math.floor((now - new Date(refDate)) / (1000 * 60 * 60 * 24));
      aging[agingBucket(daysDiff)].push(s);
    });

    const totalOutstanding = sales.reduce((s, sale) => s + sale.remainingBalance, 0);

    res.json({ outstanding: sales, aging, totalOutstanding, count: sales.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getGSTR2 = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const purchases = await Purchase.find(filter).sort({ date: -1 }).populate('supplier', 'name gstNumber state');
    const b2b = purchases.filter((p) => p.supplier);
    const b2c = purchases.filter((p) => !p.supplier);
    const invoices = purchases.map((p) => {
      const taxableValue = p.taxableAmount || 0;
      const igst = p.igstTotal || 0;
      const cgst = p.cgstTotal || 0;
      const sgst = p.sgstTotal || 0;
      // Prefer the actual stored line-item gstRate when all items share one rate;
      // only fall back to deriving the effective rate from tax/taxable when items
      // carry no gstRate. This avoids fabricating a misleading single rate.
      const itemRates = [...new Set((p.items || []).map((it) => it.gstRate || 0).filter((r) => r > 0))];
      let rate;
      if (itemRates.length === 1) {
        rate = itemRates[0];
      } else if (itemRates.length === 0) {
        rate = taxableValue ? Math.round(((igst + cgst + sgst) / taxableValue) * 100) : 0;
      } else {
        // Mixed-rate bill: report blended effective rate from stored tax totals.
        rate = taxableValue ? Math.round(((igst + cgst + sgst) / taxableValue) * 100) : 0;
      }
      return {
        _id: p._id,
        gstin: p.supplier?.gstNumber || '',
        partyName: p.supplierName || p.supplier?.name || 'Unknown',
        billNo: p.billNumber || '-',
        date: p.date ? new Date(p.date).toLocaleDateString('en-IN') : '-',
        value: p.totalAmount || 0,
        rate,
        cessRate: 0,
        taxableValue,
        reverseCharge: p.reverseCharge ? 'Y' : 'N',
        igst,
        cgst,
        sgst,
        cess: p.cessTotal || 0,
        pos: p.supplier?.state || '-',
      };
    });
    const summary = {
      totalInvoices: purchases.length,
      totalTaxable: purchases.reduce((s, p) => s + (p.taxableAmount || 0), 0),
      totalGST: purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0),
      b2bCount: b2b.length,
      b2cCount: b2c.length,
    };
    res.json({ invoices, b2b, b2c, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSAC = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter, type: 'invoice' };
    const sales = await Sale.find(filter);
    const sacMap = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        const hsn = item.hsn || '';
        if (hsn.startsWith('99')) {
          if (!sacMap[hsn]) sacMap[hsn] = { sac: hsn, description: item.productName || 'SAC Service', quantity: 0, value: 0, tax: 0 };
          sacMap[hsn].quantity += item.quantity;
          sacMap[hsn].value += item.taxableAmount || 0;
          sacMap[hsn].tax += (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
        }
      });
    });
    res.json({ sacSummary: Object.values(sacMap) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const Setting = require('../models/Setting');

// #40 TDS/TCS: Sale and Purchase DO store the actually deducted/collected amounts
// in `tdsAmount` / `tcsAmount` (populated by saleController/purchaseController when
// TDS/TCS applies). These reports now PREFER those real stored values: when a
// document carries a non-zero tdsAmount/tcsAmount we report it verbatim
// (estimated:false). Only when the stored amount is absent/zero do we fall back to
// a flat-rate estimate over a flat threshold (estimated:true, with the rate used),
// because the model still does NOT capture section codes, party-specific
// exemptions/lower-deduction certificates, or PAN-linked deduction records needed
// for a fully section-wise computation.
const TDS_RATE = 10;
const TDS_THRESHOLD = 30000;
const TCS_RATE = 1;
const TCS_THRESHOLD = 50000;

// Fix 14: rates/thresholds and default section codes are configurable per business
// via Settings (preferences.taxes); the constants above are only the fallback.
const taxConfig = (setting) => {
  const t = setting?.preferences?.taxes || {};
  return {
    tdsRate: t.tdsRate != null ? Number(t.tdsRate) : TDS_RATE,
    tdsThreshold: t.tdsThreshold != null ? Number(t.tdsThreshold) : TDS_THRESHOLD,
    tcsRate: t.tcsRate != null ? Number(t.tcsRate) : TCS_RATE,
    tcsThreshold: t.tcsThreshold != null ? Number(t.tcsThreshold) : TCS_THRESHOLD,
    tdsSection: t.tdsSection || '194Q',
    tcsSection: t.tcsSection || '206C(1H)',
  };
};

function getQuarter(date) {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  if (month < 3) return { quarter: 'Q4', fy: `${year - 1}-${year}` };
  if (month < 6) return { quarter: 'Q1', fy: `${year}-${year + 1}` };
  if (month < 9) return { quarter: 'Q2', fy: `${year}-${year + 1}` };
  return { quarter: 'Q3', fy: `${year}-${year + 1}` };
}

const getTDSReceivable = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const userSetting = await Setting.findOne(getSettingQuery(req));
    const enableTDS = userSetting?.preferences?.taxes?.enableTDS;
    if (!enableTDS) {
      return res.json({ enabled: false, entries: [], totalTDS: 0, summary: { totalTaxableAmount: 0, totalTDS: 0, entryCount: 0 } });
    }
    const cfg = taxConfig(userSetting);

    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .populate('customer', 'name gstNumber panNumber');

    const entries = [];
    let totalTDS = 0;
    let totalTaxableAmount = 0;
    let estimatedCount = 0;

    for (const sale of sales) {
      const taxableAmount = sale.taxableAmount || sale.totalAmount || 0;
      const r = computeTdsTcs(taxableAmount, sale.tdsAmount, { rate: cfg.tdsRate, threshold: cfg.tdsThreshold });
      if (!r) continue;
      if (r.estimated) estimatedCount += 1;
      totalTDS += r.amount;
      totalTaxableAmount += taxableAmount;

      entries.push({
        date: sale.date,
        partyName: sale.customerName || sale.customer?.name || 'Walk-in',
        invoiceNo: sale.invoiceNumber || '-',
        section: sale.tdsSection || cfg.tdsSection,
        taxableAmount,
        tdsPct: r.pct,
        tdsAmount: r.amount,
        estimated: r.estimated,
        receivableAmount: taxableAmount - r.amount,
      });
    }

    res.json({
      enabled: true,
      entries,
      totalTDS,
      summary: { totalTaxableAmount, totalTDS, entryCount: entries.length, estimatedCount, estimatedRate: cfg.tdsRate, estimatedThreshold: cfg.tdsThreshold, section: cfg.tdsSection },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTDSPayable = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const userSetting = await Setting.findOne(getSettingQuery(req));
    const enableTDS = userSetting?.preferences?.taxes?.enableTDS;
    if (!enableTDS) {
      return res.json({ enabled: false, entries: [], totalTDS: 0, summary: { totalTaxableAmount: 0, totalTDS: 0, entryCount: 0 } });
    }
    const cfg = taxConfig(userSetting);

    const purchases = await Purchase.find(filter)
      .sort({ date: -1 })
      .populate('supplier', 'name panNumber');

    const entries = [];
    let totalTDS = 0;
    let totalTaxableAmount = 0;
    let estimatedCount = 0;

    for (const purchase of purchases) {
      const taxableAmount = purchase.taxableAmount || purchase.totalAmount || 0;
      const r = computeTdsTcs(taxableAmount, purchase.tdsAmount, { rate: cfg.tdsRate, threshold: cfg.tdsThreshold });
      if (!r) continue;
      if (r.estimated) estimatedCount += 1;
      totalTDS += r.amount;
      totalTaxableAmount += taxableAmount;

      entries.push({
        date: purchase.date,
        vendorName: purchase.supplierName || purchase.supplier?.name || 'Unknown',
        billNo: purchase.billNumber || '-',
        section: purchase.tdsSection || cfg.tdsSection,
        taxableAmount,
        tdsPct: r.pct,
        tdsAmount: r.amount,
        estimated: r.estimated,
        payableAmount: taxableAmount - r.amount,
      });
    }

    res.json({
      enabled: true,
      entries,
      totalTDS,
      summary: { totalTaxableAmount, totalTDS, entryCount: entries.length, estimatedCount, estimatedRate: cfg.tdsRate, estimatedThreshold: cfg.tdsThreshold, section: cfg.tdsSection },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTCSReceivable = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const userSetting = await Setting.findOne(getSettingQuery(req));
    const enableTCS = userSetting?.preferences?.taxes?.enableTCS;
    if (!enableTCS) {
      return res.json({ enabled: false, entries: [], totalTCS: 0, summary: { totalTaxableAmount: 0, totalTCS: 0, entryCount: 0 } });
    }
    const cfg = taxConfig(userSetting);

    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .populate('customer', 'name gstNumber');

    const entries = [];
    let totalTCS = 0;
    let totalTaxableAmount = 0;
    let estimatedCount = 0;

    for (const sale of sales) {
      const taxableAmount = sale.taxableAmount || sale.totalAmount || 0;
      const r = computeTdsTcs(taxableAmount, sale.tcsAmount, { rate: cfg.tcsRate, threshold: cfg.tcsThreshold });
      if (!r) continue;
      if (r.estimated) estimatedCount += 1;
      totalTCS += r.amount;
      totalTaxableAmount += taxableAmount;

      entries.push({
        date: sale.date,
        partyName: sale.customerName || sale.customer?.name || 'Walk-in',
        invoiceNo: sale.invoiceNumber || '-',
        section: sale.tcsSection || cfg.tcsSection,
        taxableAmount,
        tcsPct: r.pct,
        tcsAmount: r.amount,
        estimated: r.estimated,
        receivableAmount: taxableAmount + r.amount,
      });
    }

    res.json({
      enabled: true,
      entries,
      totalTCS,
      summary: { totalTaxableAmount, totalTCS, entryCount: entries.length, estimatedCount, estimatedRate: cfg.tcsRate, estimatedThreshold: cfg.tcsThreshold, section: cfg.tcsSection },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getForm27EQ = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const userSetting = await Setting.findOne(getSettingQuery(req));
    const enableTCS = userSetting?.preferences?.taxes?.enableTCS;
    if (!enableTCS) {
      return res.json({ enabled: false, sections: [], summary: { totalTransactionAmount: 0, totalTCS: 0, entryCount: 0 } });
    }
    const cfg = taxConfig(userSetting);

    const sales = await Sale.find(filter)
      .sort({ date: -1 })
      .populate('customer', 'name gstNumber panNumber');

    const collectorName = userSetting?.businessName || 'N/A';
    const tan = userSetting?.gstNumber || 'N/A';

    const sections = [];
    let totalTCS = 0;
    let totalTransactionAmount = 0;
    let estimatedCount = 0;

    for (const sale of sales) {
      const taxableAmount = sale.taxableAmount || sale.totalAmount || 0;
      const r = computeTdsTcs(taxableAmount, sale.tcsAmount, { rate: cfg.tcsRate, threshold: cfg.tcsThreshold });
      if (!r) continue;
      if (r.estimated) estimatedCount += 1;
      totalTCS += r.amount;
      totalTransactionAmount += taxableAmount;

      const customerPan = sale.customer?.panNumber || sale.customerGst?.substring(2, 12) || 'N/A';

      sections.push({
        collectorName,
        tan,
        partyName: sale.customerName || sale.customer?.name || 'Walk-in',
        pan: customerPan,
        section: sale.tcsSection || cfg.tcsSection,
        transactionAmount: taxableAmount,
        tcsPct: r.pct,
        tcsAmount: r.amount,
        estimated: r.estimated,
      });
    }

    res.json({
      enabled: true,
      sections,
      summary: { totalTransactionAmount, totalTCS, entryCount: sections.length, estimatedCount, estimatedRate: cfg.tcsRate, estimatedThreshold: cfg.tcsThreshold, section: cfg.tcsSection },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBankStatement = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const { accountId } = req.query;
    const filter = { ...baseFilter, type: /bank/ };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    let transactions = await Transaction.find(filter).lean();

    // When a specific bank account is chosen, narrow to its transactions and start
    // the running balance from that account's opening balance, so the Balance column
    // reflects only the selected account (Transactions carry no account id, so we
    // match on the account's identifying text — name / bank name / account number).
    let openingBalance = 0;
    if (accountId && accountId !== 'all') {
      const account = await Account.findOne({ ...baseFilter, _id: accountId }).lean();
      if (account) {
        const needles = bankAccountNeedles(account);
        transactions = transactions.filter((t) => transactionMatchesAccount(t, needles));
        openingBalance = account.openingBalance || 0;
      }
    }

    const entries = bankStatementRows(transactions, openingBalance);
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    res.json({ entries, totalDebit, totalCredit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExpenseReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const entries = await Expense.find(filter).sort({ date: -1 });
    const totalAmount = entries.reduce((s, e) => s + e.totalAmount, 0);
    res.json({ entries, totalAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSaleOrders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'order' };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }
    const orders = await Sale.find(filter).sort({ date: -1 });
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);
    res.json({ orders, totalOrders, totalAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDiscountReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const sales = await Sale.find(filter).sort({ date: -1 });
    const entries = sales.map((s) => {
      const itemDiscount = s.items.reduce((sum, item) => {
        const expected = item.rate * item.quantity;
        return sum + Math.max(0, expected - item.amount);
      }, 0);
      const discount = itemDiscount + (s.discount || 0);
      return { _id: s._id, invoiceNumber: s.invoiceNumber, date: s.date, customerName: s.customerName, discount, totalAmount: s.totalAmount };
    });
    const totalDiscount = entries.reduce((s, e) => s + e.discount, 0);
    res.json({ entries, totalDiscount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLoanStatement = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter };
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const [journalEntries, loanAccounts] = await Promise.all([
      JournalEntry.find({ ...filter, referenceType: { $in: ['journal', 'payment', 'receipt'] } })
        .sort({ entryDate: -1 })
        .lean(),
      Account.find({ ...baseFilter, type: 'liability', category: { $in: ['loan', 'payable'] } }).lean(),
    ]);

    const entries = journalEntries.map(je => ({
      date: je.entryDate,
      voucherType: je.referenceType,
      referenceNo: je.entryNumber,
      description: je.narration || '',
      debit: je.totalDebit,
      credit: je.totalCredit,
      balance: je.totalDebit - je.totalCredit,
    }));

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    res.json({
      entries,
      totalPrincipal: totalCredit,
      totalInterest: 0,
      outstanding: Math.abs(totalDebit - totalCredit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExpenseCategoryReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const entries = await Expense.find(filter);
    const catMap = {};
    entries.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { categoryName: cat, totalTransactions: 0, totalAmount: 0 };
      catMap[cat].totalAmount += e.totalAmount;
      catMap[cat].totalTransactions += 1;
    });
    res.json({ categories: Object.values(catMap) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExpenseItemReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const expenses = await Expense.find(filter).sort({ date: -1 }).lean();

    // Item-level data lives inside each expense's items[] array. Aggregate per
    // item (grouped by item name + parent category) so the report breaks down
    // by item instead of rendering blank flat fields.
    const itemMap = {};
    for (const exp of expenses) {
      const category = exp.category || 'Uncategorized';
      const lineItems = Array.isArray(exp.items) ? exp.items : [];
      if (lineItems.length === 0) {
        // Expense with no line items: fall back to the expense as a single row.
        const name = exp.description || exp.category || 'Expense';
        const key = `${name}||${category}`;
        if (!itemMap[key]) itemMap[key] = { itemName: name, category, quantity: 0, amount: 0 };
        itemMap[key].quantity += 1;
        itemMap[key].amount += exp.totalAmount || exp.amount || 0;
        continue;
      }
      for (const it of lineItems) {
        const name = it.item || it.name || 'Unnamed Item';
        const key = `${name}||${category}`;
        if (!itemMap[key]) itemMap[key] = { itemName: name, category, quantity: 0, amount: 0 };
        itemMap[key].quantity += it.quantity || 0;
        const lineAmount = it.amount || ((it.rate || it.price || 0) * (it.quantity || 0));
        itemMap[key].amount += lineAmount;
      }
    }

    const entries = Object.values(itemMap).sort((a, b) => b.amount - a.amount);
    const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
    const totalQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    res.json({ entries, totalAmount, totalQuantity });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPartyStatement = async (req, res) => {
  try {
    const { partyId, partyType = 'customer', startDate, endDate, page = 1, limit = 50 } = req.query;
    if (!partyId) return res.status(400).json({ message: 'partyId is required' });

    const baseFilter = getBaseFilter(req);
    const dateFilter = { ...baseFilter };
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }

    let party, transactions, totalDue = 0, totalPaid = 0;

    if (partyType === 'customer') {
      party = await Customer.findOne({ _id: partyId, ...getBaseFilter(req) });
      if (!party) return res.status(404).json({ message: 'Customer not found' });

      const allSales = await Sale.find({ ...baseFilter, customer: partyId, type: 'invoice' }).sort({ date: -1 });
      const salesInRange = await Sale.find({ ...dateFilter, customer: partyId, type: 'invoice' }).sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)).lean();

      totalDue = allSales.reduce((s, sale) => s + sale.totalAmount, 0);
      totalPaid = allSales.reduce((s, sale) => s + (sale.paidAmount || 0), 0);

      transactions = salesInRange.map(s => ({
        date: s.date, txnType: 'Sale', refNo: s.invoiceNumber,
        paymentType: s.paymentStatus || 'unpaid',
        total: s.totalAmount, received: s.paidAmount || 0,
        txnBalance: (s.totalAmount - (s.paidAmount || 0)),
        receivableBalance: s.remainingBalance || 0,
        payableBalance: 0,
      }));
    } else {
      party = await Supplier.findOne({ _id: partyId, ...getBaseFilter(req) });
      if (!party) return res.status(404).json({ message: 'Supplier not found' });

      const allPurchases = await Purchase.find({ ...baseFilter, supplier: partyId }).sort({ date: -1 });
      const purchasesInRange = await Purchase.find({ ...dateFilter, supplier: partyId }).sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)).lean();

      totalDue = allPurchases.reduce((s, p) => s + p.totalAmount, 0);
      totalPaid = allPurchases.reduce((s, p) => s + (p.paidAmount || 0), 0);

      transactions = purchasesInRange.map(p => ({
        date: p.date, txnType: 'Purchase', refNo: p.billNumber,
        paymentType: p.paymentStatus || 'unpaid',
        total: p.totalAmount, received: p.paidAmount || 0,
        txnBalance: (p.totalAmount - (p.paidAmount || 0)),
        receivableBalance: 0,
        payableBalance: p.remainingBalance || 0,
      }));
    }

    const openingBalance = party.openingBalance || 0;
    const totalCount = partyType === 'customer'
      ? await Sale.countDocuments({ ...dateFilter, customer: partyId, type: 'invoice' })
      : await Purchase.countDocuments({ ...dateFilter, supplier: partyId });

    res.json({
      partyName: party.name,
      openingBalance,
      totalDue,
      totalPaid,
      outstanding: totalDue - totalPaid,
      transactions,
      page: parseInt(page),
      pages: Math.ceil(totalCount / parseInt(limit)),
      total: totalCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPartyWiseProfitLoss = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }

    const customers = await Customer.find({ ...baseFilter }).lean();
    const suppliers = await Supplier.find({ ...baseFilter }).lean();
    const sales = await Sale.find({ ...filter, type: 'invoice' }).lean();
    const purchases = await Purchase.find(filter).lean();

    const customerMap = {};
    for (const c of customers) {
      const partySales = sales.filter(s => String(s.customer) === String(c._id));
      const totalSale = partySales.reduce((s, sale) => s + sale.totalAmount, 0);
      const totalCost = partySales.reduce((s, sale) => {
        return s + (sale.items || []).reduce((si, item) => si + ((item.costPrice || 0) * item.quantity), 0);
      }, 0);
      customerMap[c._id] = {
        partyName: c.name,
        phone: c.phone || '-',
        totalSale,
        profit: totalSale - totalCost,
      };
    }

    const supplierMap = {};
    for (const s of suppliers) {
      const partyPurchases = purchases.filter(p => String(p.supplier) === String(s._id));
      const totalPurchase = partyPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalCost = partyPurchases.reduce((sum, p) => {
        return sum + (p.items || []).reduce((si, item) => si + ((item.costPrice || 0) * item.quantity), 0);
      }, 0);
      supplierMap[s._id] = {
        partyName: s.name,
        phone: s.phone || '-',
        totalSale: -totalPurchase,
        profit: -(totalPurchase - totalCost),
      };
    }

    const report = [
      ...Object.values(customerMap),
      ...Object.values(supplierMap),
    ].sort((a, b) => b.totalSale - a.totalSale);

    res.json({ entries: report, total: report.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPartyReportByItem = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, partyType } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }

    const entries = [];

    if (!partyType || partyType === 'customer') {
      const sales = await Sale.find({ ...filter, type: 'invoice' }).populate('customer', 'name').lean();
      for (const sale of sales) {
        for (const item of (sale.items || [])) {
          entries.push({
            party: sale.customerName || sale.customer?.name || 'Unknown',
            item: item.productName || item.name || 'Unknown',
            saleQty: item.quantity || 0,
            saleAmount: item.amount || 0,
            purchaseQty: 0,
            purchaseAmount: 0,
          });
        }
      }
    }

    if (!partyType || partyType === 'supplier') {
      const purchases = await Purchase.find(filter).populate('supplier', 'name').lean();
      for (const purchase of purchases) {
        for (const item of (purchase.items || [])) {
          const existing = entries.find(
            e => e.party === (purchase.supplierName || purchase.supplier?.name || 'Unknown') && e.item === (item.productName || item.name || 'Unknown')
          );
          if (existing) {
            existing.purchaseQty += item.quantity || 0;
            existing.purchaseAmount += item.amount || 0;
          } else {
            entries.push({
              party: purchase.supplierName || purchase.supplier?.name || 'Unknown',
              item: item.productName || item.name || 'Unknown',
              saleQty: 0,
              saleAmount: 0,
              purchaseQty: item.quantity || 0,
              purchaseAmount: item.amount || 0,
            });
          }
        }
      }
    }

    res.json({ entries, total: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSalePurchaseByParty = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }

    const sales = await Sale.find({ ...filter, type: 'invoice' }).lean();
    const purchases = await Purchase.find(filter).lean();

    const partyMap = {};

    for (const sale of sales) {
      const name = sale.customerName || 'Unknown';
      if (!partyMap[name]) partyMap[name] = { partyName: name, saleAmount: 0, purchaseAmount: 0 };
      partyMap[name].saleAmount += sale.totalAmount || 0;
    }

    for (const purchase of purchases) {
      const name = purchase.supplierName || 'Unknown';
      if (!partyMap[name]) partyMap[name] = { partyName: name, saleAmount: 0, purchaseAmount: 0 };
      partyMap[name].purchaseAmount += purchase.totalAmount || 0;
    }

    const entries = Object.values(partyMap).sort((a, b) => b.saleAmount + b.purchaseAmount - (a.saleAmount + a.purchaseAmount));
    res.json({ entries, total: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSalePurchaseByPartyGroup = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }

    const Setting = require('../models/Setting');
    const userSetting = await Setting.findOne(getSettingQuery(req));
    const partyGrouping = userSetting?.preferences?.party?.partyGrouping !== false;

    const customers = await Customer.find({ ...baseFilter }).lean();
    const suppliers = await Supplier.find({ ...baseFilter }).lean();
    const sales = await Sale.find({ ...filter, type: 'invoice' }).lean();
    const purchases = await Purchase.find(filter).lean();

    if (partyGrouping) {
      // Group by Customers vs Suppliers (existing behavior)
      const totalSales = sales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
      const totalPurchases = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
      const entries = [
        { group: 'Customers', saleAmount: totalSales, purchaseAmount: 0, count: customers.length },
        { group: 'Suppliers', saleAmount: 0, purchaseAmount: totalPurchases, count: suppliers.length },
      ].filter(e => e.saleAmount > 0 || e.purchaseAmount > 0 || e.count > 0);
      res.json({ entries, total: entries.length });
    } else {
      // Individual party grouping
      const partyMap = {};
      for (const c of customers) {
        partyMap[c.name] = { group: c.name, saleAmount: 0, purchaseAmount: 0, count: 0, type: 'Customer' };
      }
      for (const s of suppliers) {
        partyMap[s.name] = { group: s.name, saleAmount: 0, purchaseAmount: 0, count: 0, type: 'Supplier' };
      }
      for (const sale of sales) {
        const name = sale.customerName || 'Walk-in';
        if (!partyMap[name]) partyMap[name] = { group: name, saleAmount: 0, purchaseAmount: 0, count: 0, type: 'Customer' };
        partyMap[name].saleAmount += sale.totalAmount || 0;
      }
      for (const purchase of purchases) {
        const name = purchase.supplierName || 'Unknown';
        if (!partyMap[name]) partyMap[name] = { group: name, saleAmount: 0, purchaseAmount: 0, count: 0, type: 'Supplier' };
        partyMap[name].purchaseAmount += purchase.totalAmount || 0;
      }
      const entries = Object.values(partyMap).filter(e => e.saleAmount > 0 || e.purchaseAmount > 0);
      res.json({ entries, total: entries.length });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemWiseProfitLoss = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, search } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }
    const [sales, purchases] = await Promise.all([
      Sale.find({ ...filter, type: 'invoice' }).lean(),
      Purchase.find(filter).lean(),
    ]);
    const itemMap = {};
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const name = item.productName || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { itemName: name, purchaseAmount: 0, saleAmount: 0 };
        itemMap[name].saleAmount += item.amount || 0;
      }
    }
    for (const purchase of purchases) {
      for (const item of (purchase.items || [])) {
        const name = item.productName || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { itemName: name, purchaseAmount: 0, saleAmount: 0 };
        itemMap[name].purchaseAmount += item.amount || 0;
      }
    }
    let entries = Object.values(itemMap).map(item => ({
      ...item,
      profit: item.saleAmount - item.purchaseAmount,
      profitPct: item.purchaseAmount > 0 ? Math.round(((item.saleAmount - item.purchaseAmount) / item.purchaseAmount) * 100) : 0,
    }));
    if (search) entries = entries.filter(e => e.itemName.toLowerCase().includes(search.toLowerCase()));
    const totals = entries.reduce((s, e) => ({ purchaseAmount: s.purchaseAmount + e.purchaseAmount, saleAmount: s.saleAmount + e.saleAmount, profit: s.profit + e.profit }), { purchaseAmount: 0, saleAmount: 0, profit: 0 });
    res.json({ entries, ...totals, totalItems: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemCategoryProfitLoss = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, search } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }
    const products = await Product.find({ ...baseFilter }).lean();
    const productCategoryMap = {};
    for (const p of products) { productCategoryMap[p._id] = p.category || 'Uncategorized'; }

    const [sales, purchases] = await Promise.all([
      Sale.find({ ...filter, type: 'invoice' }).lean(),
      Purchase.find(filter).lean(),
    ]);
    const catMap = {};
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const cat = item.product ? (productCategoryMap[item.product] || 'Uncategorized') : 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { category: cat, purchaseAmount: 0, saleAmount: 0 };
        catMap[cat].saleAmount += item.amount || 0;
      }
    }
    for (const purchase of purchases) {
      for (const item of (purchase.items || [])) {
        const cat = item.product ? (productCategoryMap[item.product] || 'Uncategorized') : 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { category: cat, purchaseAmount: 0, saleAmount: 0 };
        catMap[cat].purchaseAmount += item.amount || 0;
      }
    }
    let entries = Object.values(catMap).map(c => ({
      ...c,
      profit: c.saleAmount - c.purchaseAmount,
      profitPct: c.purchaseAmount > 0 ? Math.round(((c.saleAmount - c.purchaseAmount) / c.purchaseAmount) * 100) : 0,
    }));
    if (search) entries = entries.filter(e => e.category.toLowerCase().includes(search.toLowerCase()));
    const totals = entries.reduce((s, e) => ({ purchaseAmount: s.purchaseAmount + e.purchaseAmount, saleAmount: s.saleAmount + e.saleAmount, profit: s.profit + e.profit }), { purchaseAmount: 0, saleAmount: 0, profit: 0 });
    res.json({ entries, ...totals, totalItems: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemReportByParty = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, search } = req.query;
    const filter = { ...baseFilter };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }
    const entries = [];
    const sales = await Sale.find({ ...filter, type: 'invoice' }).lean();
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        entries.push({
          partyName: sale.customerName || 'Unknown',
          itemName: item.productName || 'Unknown',
          voucher: sale.invoiceNumber || '-',
          date: sale.date,
          qty: item.quantity || 0,
          rate: item.rate || 0,
          tax: (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0),
          amount: item.amount || 0,
        });
      }
    }
    const purchases = await Purchase.find(filter).lean();
    for (const purchase of purchases) {
      for (const item of (purchase.items || [])) {
        entries.push({
          partyName: purchase.supplierName || 'Unknown',
          itemName: item.productName || 'Unknown',
          voucher: purchase.billNumber || '-',
          date: purchase.date,
          qty: item.quantity || 0,
          rate: item.rate || 0,
          tax: (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0),
          amount: item.amount || 0,
        });
      }
    }
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    let filtered = entries;
    if (search) filtered = entries.filter(e => e.partyName.toLowerCase().includes(search.toLowerCase()) || e.itemName.toLowerCase().includes(search.toLowerCase()));
    const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
    res.json({ entries: filtered, totalAmount, totalItems: filtered.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStockDetail = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, productId } = req.query;
    const filter = { ...baseFilter };
    if (productId) filter.product = productId;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    // Paginate instead of silently truncating at 500 rows (which hid older movements).
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const total = await StockMovement.countDocuments(filter);
    const movements = await StockMovement.find(filter)
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const saleIds = [];
    const purchaseIds = [];
    for (const m of movements) {
      if (m.referenceType === 'Sale') saleIds.push(m.referenceId);
      else if (m.referenceType === 'Purchase') purchaseIds.push(m.referenceId);
    }
    const [sales, purchases] = await Promise.all([
      saleIds.length ? Sale.find({ _id: { $in: saleIds } }).select('customerName invoiceNumber warehouse').lean() : [],
      purchaseIds.length ? Purchase.find({ _id: { $in: purchaseIds } }).select('supplierName billNumber').lean() : [],
    ]);
    const saleMap = {};
    for (const s of sales) { saleMap[s._id] = s; }
    const purchaseMap = {};
    for (const p of purchases) { purchaseMap[p._id] = p; }

    const entries = movements.map((m) => {
      let partyName = m.description || m.productName || '-';
      let voucherNo = m.referenceNumber || '-';
      let warehouse = '-';
      if (m.referenceType === 'Sale' && saleMap[m.referenceId]) {
        partyName = saleMap[m.referenceId].customerName || partyName;
        voucherNo = saleMap[m.referenceId].invoiceNumber || voucherNo;
        warehouse = saleMap[m.referenceId].warehouse || '-';
      } else if (m.referenceType === 'Purchase' && purchaseMap[m.referenceId]) {
        partyName = purchaseMap[m.referenceId].supplierName || partyName;
        voucherNo = purchaseMap[m.referenceId].billNumber || voucherNo;
      }
      return {
        date: m.date,
        voucherType: m.referenceType || m.type || '-',
        voucherNo,
        partyName,
        warehouse,
        inward: m.quantity > 0 ? m.quantity : 0,
        outward: m.quantity < 0 ? Math.abs(m.quantity) : 0,
        balance: m.balanceAfter || 0,
      };
    });
    res.json({ entries, total, count: entries.length, limit, offset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemDetail = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { search } = req.query;
    // Services are not stockable; exclude them from this stock/inventory report.
    const filter = { ...baseFilter, isActive: true, type: { $ne: 'service' } };
    if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const products = await Product.find(filter).sort({ name: 1 }).lean();
    const entries = products.map(p => ({
      itemName: p.name,
      itemCode: p.sku || '-',
      hsn: p.hsn || '-',
      unit: p.unit || 'pcs',
      purchaseRate: p.costPrice || 0,
      saleRate: p.price || 0,
      currentStock: p.stock || 0,
      stockValue: ((p.stock || 0) * (p.costPrice || 0)),
    }));
    const totalStockValue = entries.reduce((s, e) => s + e.stockValue, 0);
    res.json({ entries, totalStockValue, totalItems: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSaleOrderItem = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'order' };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = (endDate.includes('T') ? new Date(endDate) : new Date(endDate + 'T23:59:59.999Z'));
    }
    const orders = await Sale.find(filter).lean();
    const itemMap = {};
    for (const order of orders) {
      const isDelivered = order.deliveryStatus === 'delivered';
      for (const item of (order.items || [])) {
        const name = item.productName || item.name || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { itemName: name, orderQty: 0, deliveredQty: 0, pendingQty: 0, amount: 0 };
        itemMap[name].orderQty += item.quantity || 0;
        itemMap[name].amount += item.amount || 0;
        if (isDelivered) {
          itemMap[name].deliveredQty += item.quantity || 0;
        } else {
          itemMap[name].pendingQty += item.quantity || 0;
        }
      }
    }
    const entries = Object.values(itemMap);
    const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
    const totalOrderQty = entries.reduce((s, e) => s + e.orderQty, 0);
    const totalDelivered = entries.reduce((s, e) => s + e.deliveredQty, 0);
    const totalPending = entries.reduce((s, e) => s + e.pendingQty, 0);
    res.json({ entries, totalAmount, totalOrderQty, totalDelivered, totalPending });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBillWiseProfit = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const sales = await Sale.find(filter).sort({ date: -1 }).lean();
    const entries = sales.map(s => {
      const costAmount = s.items.reduce((sum, item) => {
        const cost = item.costPrice || 0;
        return sum + (cost * item.quantity);
      }, 0);
      const salesAmount = s.totalAmount || 0;
      return {
        invoiceNo: s.invoiceNumber,
        customerName: s.customerName || 'Walk-in',
        date: s.date,
        salesAmount,
        costAmount,
        profit: salesAmount - costAmount,
      };
    });
    const totalSales = entries.reduce((s, e) => s + e.salesAmount, 0);
    const totalCost = entries.reduce((s, e) => s + e.costAmount, 0);
    const totalProfit = entries.reduce((s, e) => s + e.profit, 0);
    res.json({ entries, totalSales, totalCost, totalProfit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'order' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const orders = await Sale.find(filter).sort({ date: -1 }).lean();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getEMISchedule = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const loanAccounts = await Account.find({ ...baseFilter, type: 'liability', category: 'loan' }).lean();
    const loanAccountIds = loanAccounts.map(a => a._id);
    const loanIdSet = new Set(loanAccountIds.map(id => id.toString()));
    // JournalEntry stores embedded `lines[]` each with { account, accountName, debit, credit }.
    // Match entries that touch any loan account on one of their lines.
    const entries = await JournalEntry.find({
      ...filter,
      'lines.account': { $in: loanAccountIds },
    }).sort({ entryDate: -1 }).lean();
    const accountMap = {};
    loanAccounts.forEach(a => { accountMap[a._id.toString()] = a.name; });
    const result = entries.map((e, i) => {
      // Pick the line that references the loan account; debit reduces the loan
      // (EMI repayment), credit increases it (disbursement / interest accrual).
      const loanLine = (e.lines || []).find(l => l.account && loanIdSet.has(l.account.toString()));
      const debit = loanLine?.debit || 0;
      const credit = loanLine?.credit || 0;
      return {
        date: e.entryDate,
        accountName: (loanLine && accountMap[loanLine.account.toString()]) || loanLine?.accountName || '-',
        emiNo: i + 1,
        amount: debit || credit || 0,
        balance: credit - debit || 0,
      };
    });
    res.json({ entries: result, total: result.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLoanSummary = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const loanAccounts = await Account.find({ ...baseFilter, type: 'liability', category: 'loan' }).lean();
    const loans = await Promise.all(loanAccounts.map(async (a) => {
      const aid = a._id.toString();
      // JournalEntry stores embedded `lines[]` each with { account, debit, credit }.
      // Match entries whose lines reference this loan account, then read debit/credit
      // from the matching line(s).
      const entries = await JournalEntry.find({
        ...baseFilter,
        'lines.account': a._id,
      }).lean();
      let totalDebit = 0;
      let totalCredit = 0;
      entries.forEach((e) => {
        (e.lines || []).forEach((l) => {
          if (l.account && l.account.toString() === aid) {
            totalDebit += l.debit || 0;
            totalCredit += l.credit || 0;
          }
        });
      });
      // For a liability loan account: credits = amount borrowed/owed (loan given to
      // the business), debits = repayments made. Outstanding = credit - debit.
      const totalGiven = totalCredit;
      const totalPaid = totalDebit;
      return {
        accountName: a.name,
        loanType: a.category || 'Loan',
        totalGiven,
        totalPaid,
        outstanding: totalGiven - totalPaid,
      };
    }));
    const totalGivenAll = loans.reduce((s, l) => s + l.totalGiven, 0);
    const totalPaidAll = loans.reduce((s, l) => s + l.totalPaid, 0);
    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
    res.json({ loans, totalGivenAll, totalPaidAll, totalOutstanding });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStockAging = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    // Services are not stockable; exclude them from this stock/inventory report.
    const products = await Product.find({ ...baseFilter, type: { $ne: 'service' } }).lean();
    const productIds = products.map(p => p._id);
    const movements = await StockMovement.find({
      ...baseFilter,
      product: { $in: productIds },
      type: 'purchase',
    }).sort({ date: 1 }).lean();
    const firstMovement = {};
    movements.forEach(m => {
      const pid = m.product?.toString();
      if (pid && (!firstMovement[pid] || m.date < firstMovement[pid].date)) {
        firstMovement[pid] = m;
      }
    });
    const now = new Date();
    const aging = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
    products.forEach(p => {
      const fm = firstMovement[p._id.toString()];
      const days = fm ? Math.floor((now - new Date(fm.date)) / (1000 * 60 * 60 * 24)) : 0;
      const bucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      aging[bucket].push({
        _id: p._id,
        name: p.name,
        sku: p.sku || '',
        stock: p.stock || 0,
        costPrice: p.costPrice || 0,
        value: ((p.stock || 0) * (p.costPrice || 0)),
        daysInStock: days,
        firstPurchaseDate: fm ? fm.date : null,
      });
    });
    Object.keys(aging).forEach(k => aging[k].sort((a, b) => b.daysInStock - a.daysInStock));
    const totalValue = products.reduce((s, p) => s + ((p.stock || 0) * (p.costPrice || 0)), 0);
    res.json({ aging, totalValue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLowStockReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    // Services are not stockable; exclude them from this low-stock report.
    const products = await Product.find({
      ...baseFilter,
      type: { $ne: 'service' },
      $expr: { $and: [{ $gt: ['$minStock', 0] }, { $lte: ['$stock', '$minStock'] }] },
    }).sort({ stock: 1 }).lean();
    const totalShortage = products.reduce((s, p) => s + Math.max(0, (p.minStock || 0) - (p.stock || 0)), 0);
    res.json({ products, count: products.length, totalShortage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPaymentReminders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const now = new Date();
    const overdueSales = await Sale.find({
      ...baseFilter,
      paymentStatus: { $ne: 'paid' },
      remainingBalance: { $gt: 0 },
    }).populate('customer', 'name phone').sort({ date: 1 }).lean();
    const overduePurchases = await Purchase.find({
      ...baseFilter,
      remainingBalance: { $gt: 0 },
      paymentStatus: { $ne: 'paid' },
    }).populate('supplier', 'name phone').sort({ date: 1 }).lean();
    const sales = overdueSales.map(s => ({
      _id: s._id,
      type: 'sale',
      partyName: s.customer?.name || 'Walk-in',
      partyPhone: s.customer?.phone || '',
      invoiceNo: s.invoiceNumber || s._id,
      date: s.date,
      dueDate: s.dueDate || s.date,
      totalAmount: s.totalAmount || 0,
      paidAmount: s.paidAmount || 0,
      balance: s.remainingBalance || 0,
      daysOverdue: Math.floor((now - new Date(s.dueDate || s.date)) / (1000 * 60 * 60 * 24)),
    }));
    const purchases = overduePurchases.map(p => ({
      _id: p._id,
      type: 'purchase',
      partyName: p.supplier?.name || 'Unknown',
      partyPhone: p.supplier?.phone || '',
      invoiceNo: p.billNumber || p._id,
      date: p.date,
      dueDate: p.dueDate || p.date,
      totalAmount: p.totalAmount || 0,
      paidAmount: p.paidAmount || 0,
      balance: p.remainingBalance || 0,
      daysOverdue: Math.floor((now - new Date(p.dueDate || p.date)) / (1000 * 60 * 60 * 24)),
    }));
    const all = [...sales, ...purchases].sort((a, b) => b.daysOverdue - a.daysOverdue);
    const summary = {
      totalOverdue: all.length,
      totalAmount: all.reduce((s, i) => s + i.totalAmount, 0),
      totalBalance: all.reduce((s, i) => s + i.balance, 0),
      overdueSales: sales.length,
      overduePurchases: purchases.length,
    };
    res.json({ reminders: all, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LIMITATION (#39 GSTR-2A): A true GSTR-2A reconciliation compares the supplier-
// filed invoices downloaded from the GST portal against the purchases recorded in
// the books. This app does NOT import GSTR-2A data from the portal, so there is no
// independent "as-per-2A" dataset to match against. The figures below are derived
// entirely from the locally recorded Purchase documents: each purchase is treated
// as "matched" when its supplier carries a valid 15-char GSTIN, and its own booked
// GST is reported as ITC-claimable. `difference` is therefore always 0. These are
// book-side estimates pending a real GSTR-2A import/source feed.
// #39 GSTR-2A reconciliation.
// The data model has no live GSTR-2A portal feed. What it CAN provide:
//  - Book side: real inward (purchase) invoices with stored CGST/SGST/IGST.
//  - 2A side (optional): a GstRecord collection, populated only when the user has
//    imported GST portal data (importController). When present we treat it as the
//    "as-per-2A" side and compute genuine per-invoice differences; when absent we
//    return book-side figures only and flag that no 2A import exists. We never
//    fabricate a 2A dataset.
const normalizeGstin = (g) => (g || '').toString().trim().toUpperCase();
const normalizeInvNo = (n) => (n || '').toString().trim().toUpperCase();

const getGSTR2AReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    const recordFilter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
      recordFilter.invoiceDate = { $gte: new Date(startDate), $lt: end };
    }

    const [purchases, gstRecords] = await Promise.all([
      Purchase.find(filter).populate('supplier', 'name gstNumber').sort({ date: -1 }).lean(),
      // 2A side: imported GST portal invoices, if any exist for this tenant/period.
      GstRecord.find(recordFilter).lean(),
    ]);

    const hasImport2A = gstRecords.length > 0;

    // Index the imported 2A rows by GSTIN + invoice number for matching.
    const recordMap = new Map();
    for (const r of gstRecords) {
      const key = `${normalizeGstin(r.partyGstin)}|${normalizeInvNo(r.invoiceNumber)}`;
      recordMap.set(key, r);
    }
    const usedKeys = new Set();

    const reconciliation = purchases.map(p => {
      const supplierGst = normalizeGstin(p.supplier?.gstNumber);
      // ITC is only claimable against a registered (15-char GSTIN) supplier.
      const itcEligible = supplierGst.length === 15;
      const bookCgst = p.cgstTotal || 0;
      const bookSgst = p.sgstTotal || 0;
      const bookIgst = p.igstTotal || 0;
      const bookTotalGst = bookCgst + bookSgst + bookIgst;
      const invKey = `${supplierGst}|${normalizeInvNo(p.billNumber)}`;

      const row = {
        _id: p._id,
        invoiceNo: p.billNumber || String(p._id),
        date: p.date,
        supplierName: p.supplier?.name || p.supplierName || 'Unknown',
        supplierGstin: supplierGst,
        // Book-side (as-per-books) figures — sourced from the purchase document.
        bookTaxableValue: p.taxableAmount || 0,
        bookCgst,
        bookSgst,
        bookIgst,
        bookTotalGst,
        bookTotal: p.totalAmount || 0,
        itcEligible,
        itcClaimable: itcEligible ? bookTotalGst : 0,
      };

      if (hasImport2A) {
        const match = recordMap.get(invKey);
        if (match && !usedKeys.has(invKey)) {
          usedKeys.add(invKey);
          const as2aGst = (match.cgst || 0) + (match.sgst || 0) + (match.igst || 0) + (match.cess || 0);
          row.portalTaxableValue = match.taxableValue || 0;
          row.portalCgst = match.cgst || 0;
          row.portalSgst = match.sgst || 0;
          row.portalIgst = match.igst || 0;
          row.portalCess = match.cess || 0;
          row.portalTotalGst = as2aGst;
          // Real difference = book ITC minus what the portal (2A) reports.
          row.difference = Math.round((bookTotalGst - as2aGst) * 100) / 100;
          row.matchingStatus = Math.abs(row.difference) < 0.01 ? 'matched' : 'mismatched';
        } else {
          // In books but not in the imported 2A data → missing in 2A.
          row.difference = bookTotalGst;
          row.matchingStatus = 'missing_in_2a';
        }
      } else {
        // No 2A import: we cannot assert a match against the portal. Flag accordingly.
        row.difference = null;
        row.matchingStatus = itcEligible ? 'in_books' : 'no_gstin';
      }
      return row;
    });

    // Imported 2A invoices that have no corresponding purchase in the books.
    const missingInBooks = [];
    if (hasImport2A) {
      for (const r of gstRecords) {
        const key = `${normalizeGstin(r.partyGstin)}|${normalizeInvNo(r.invoiceNumber)}`;
        if (usedKeys.has(key)) continue;
        const as2aGst = (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0) + (r.cess || 0);
        missingInBooks.push({
          _id: r._id,
          invoiceNo: r.invoiceNumber || String(r._id),
          date: r.invoiceDate,
          supplierName: r.partyName || 'Unknown',
          supplierGstin: normalizeGstin(r.partyGstin),
          portalTaxableValue: r.taxableValue || 0,
          portalTotalGst: as2aGst,
          difference: -as2aGst,
          matchingStatus: 'missing_in_books',
        });
      }
    }

    const matched = reconciliation.filter(r => r.matchingStatus === 'matched');
    const mismatched = reconciliation.filter(r => r.matchingStatus !== 'matched');

    const summary = {
      totalInvoices: reconciliation.length,
      totalBookTaxable: reconciliation.reduce((s, r) => s + r.bookTaxableValue, 0),
      totalBookItc: reconciliation.reduce((s, r) => s + r.bookTotalGst, 0),
      totalItcClaimable: reconciliation.reduce((s, r) => s + r.itcClaimable, 0),
      matchedCount: matched.length,
      unmatchedCount: mismatched.length,
      ...(hasImport2A
        ? {
            total2AInvoices: gstRecords.length,
            total2ATax: gstRecords.reduce((s, r) => s + (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0) + (r.cess || 0), 0),
            missingInBooksCount: missingInBooks.length,
            netDifference: reconciliation.reduce((s, r) => s + (r.difference || 0), 0)
              + missingInBooks.reduce((s, r) => s + (r.difference || 0), 0),
          }
        : {}),
    };

    res.json({
      source: hasImport2A ? 'books_vs_2a_import' : 'books_only',
      note: hasImport2A
        ? 'Differences computed against imported GSTR-2A portal data (GstRecord).'
        : 'No GSTR-2A import available; figures are book-side (as-per-books) only. Differences require a portal 2A import.',
      matched,
      mismatched,
      missingInBooks,
      summary,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSalePurchaseByItemCategory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const saleFilter = { ...baseFilter, type: 'invoice' };
    const purchaseFilter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      saleFilter.date = { $gte: new Date(startDate), $lt: end };
      purchaseFilter.date = { $gte: new Date(startDate), $lt: end };
    }

    const [sales, purchases, products] = await Promise.all([
      Sale.find(saleFilter).lean(),
      Purchase.find(purchaseFilter).lean(),
      Product.find(baseFilter).lean(),
    ]);

    const productCatMap = {};
    products.forEach(p => { productCatMap[p._id.toString()] = p.category || 'Uncategorized'; });

    const catMap = {};
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const cat = productCatMap[item.product?.toString()] || item.category || 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { category: cat, sales: 0, purchases: 0 };
        catMap[cat].sales += item.amount || 0;
      });
    });
    purchases.forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const cat = productCatMap[item.product?.toString()] || item.category || 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { category: cat, sales: 0, purchases: 0 };
        catMap[cat].purchases += item.amount || 0;
      });
    });

    const entries = Object.values(catMap);
    const totalSales = entries.reduce((s, e) => s + e.sales, 0);
    const totalPurchases = entries.reduce((s, e) => s + e.purchases, 0);
    res.json({ entries, totalSales, totalPurchases });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStockSummaryByItemCategory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const products = await Product.find({ ...baseFilter, type: { $ne: 'service' } }).lean();

    const catMap = {};
    products.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { category: cat, items: 0, qty: 0, value: 0 };
      catMap[cat].items += 1;
      catMap[cat].qty += p.stock || 0;
      catMap[cat].value += (p.stock || 0) * (p.costPrice || p.price || 0);
    });

    const entries = Object.values(catMap);
    const totalItems = entries.reduce((s, e) => s + e.items, 0);
    const totalQty = entries.reduce((s, e) => s + e.qty, 0);
    const totalValue = entries.reduce((s, e) => s + e.value, 0);
    res.json({ entries, totalItems, totalQty, totalValue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemWiseDiscount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: 'invoice' };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }

    const sales = await Sale.find(filter).lean();
    const itemMap = {};

    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const name = item.productName || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { item: name, totalDiscount: 0, totalAmount: 0, discountRate: 0 };
        itemMap[name].totalDiscount += item.discountAmount || 0;
        itemMap[name].totalAmount += item.amount || 0;
      });
    });

    const entries = Object.values(itemMap).map(e => ({
      ...e,
      discountRate: e.totalAmount > 0 ? ((e.totalDiscount / e.totalAmount) * 100).toFixed(1) : 0,
    }));
    const totalDiscount = entries.reduce((s, e) => s + e.totalDiscount, 0);
    res.json({ entries, totalDiscount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Fix 17: Stock reconciliation — compares each product's snapshot quantity
// (Product.stock) against the running balance implied by the StockMovement ledger
// (latest balanceAfter), surfacing any drift between the two sources of truth.
const getStockReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const aggBase = toAggBase(baseFilter);
    const [products, ledgerAgg] = await Promise.all([
      Product.find({ ...baseFilter, isActive: true, type: { $ne: 'service' } }).select('name stock type').lean(),
      StockMovement.aggregate([
        { $match: aggBase },
        { $sort: { date: 1, _id: 1 } },
        { $group: { _id: '$product', qty: { $last: '$balanceAfter' } } },
      ]),
    ]);
    const ledgerQtyById = {};
    ledgerAgg.forEach((r) => { if (r._id) ledgerQtyById[r._id.toString()] = r.qty; });
    const { rows, summary } = reconcileStock(products, ledgerQtyById);
    res.json({ entries: rows, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Fix 20: Godown-wise stock — the per-godown distribution of each product's stock
// (Product.godownStock[]) flattened into one row per (godown, item), with valuation.
const getGodownStock = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { godownId } = req.query;
    const [products, godowns] = await Promise.all([
      Product.find({ ...baseFilter, isActive: true, type: { $ne: 'service' } })
        .select('name costPrice purchasePrice price type godownStock').lean(),
      Godown.find({ ...baseFilter }).select('name').lean(),
    ]);
    const godownNameById = {};
    godowns.forEach((g) => { godownNameById[g._id.toString()] = g.name; });

    let entries = buildGodownStock(products, godownNameById);
    if (godownId) {
      const name = godownNameById[String(godownId)];
      if (name) entries = entries.filter((e) => e.godown === name);
    }
    const totalValue = entries.reduce((s, e) => s + e.value, 0);
    res.json({ entries, totalValue, godowns: godowns.map((g) => ({ _id: g._id, name: g.name })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Wrap every handler so dateFrom/dateTo are normalized to startDate/endDate
// before the handler runs. This guarantees consistent date-range filtering
// regardless of which query-param names a given frontend report page sends.
const withDateNormalization = (fn) => async (req, res, next) => {
  normalizeDateQuery(req);
  return fn(req, res, next);
};

const handlers = {
  getSalesReport,
  getPurchaseReport,
  getProfitReport,
  getGSTReport,
  getGSTR1,
  getGSTR3B,
  getGSTR9Report,
  getHSNSummary,
  getPartyReport,
  getCashFlow,
  getDayBook,
  getOutstandingReport,
  getGSTR2,
  getSAC,
  getTDSReceivable,
  getTDSPayable,
  getTCSReceivable,
  getForm27EQ,
  getBankStatement,
  getExpenseReport,
  getSaleOrders,
  getSaleOrderItem,
  getItemDetail,
  getStockDetail,
  getStockReconciliation,
  getGodownStock,
  getDiscountReport,
  getLoanStatement,
  getExpenseCategoryReport,
  getExpenseItemReport,
  getPartyStatement,
  getPartyWiseProfitLoss,
  getPartyReportByItem,
  getSalePurchaseByParty,
  getSalePurchaseByPartyGroup,
  getItemWiseProfitLoss,
  getItemCategoryProfitLoss,
  getItemReportByParty,
  getBillWiseProfit,
  getPendingOrders,
  getEMISchedule,
  getLoanSummary,
  getStockAging,
  getLowStockReport,
  getPaymentReminders,
  getGSTR2AReconciliation,
  getSalePurchaseByItemCategory,
  getStockSummaryByItemCategory,
  getItemWiseDiscount,
};

const wrapped = {};
for (const [name, fn] of Object.entries(handlers)) {
  wrapped[name] = withDateNormalization(fn);
}

module.exports = wrapped;
