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
const { getBaseFilter, getSettingQuery } = require('../utils/queryHelper');

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

    const sales = await Sale.find({ ...filter, type: 'invoice' });
    const purchases = await Purchase.find(filter);
    const products = await Product.find({ ...baseFilter });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

    let totalCOGS = 0;
    sales.forEach((s) => {
      s.items.forEach((item) => {
        if (item.product) {
          const prod = products.find((p) => p._id.toString() === item.product.toString());
          if (prod) totalCOGS += (prod.costPrice || 0) * item.quantity;
        } else {
          totalCOGS += (item.costPrice || 0) * item.quantity;
        }
      });
    });

    const grossProfit = totalSales - totalCOGS;
    const totalGST = sales.reduce((s, sale) => s + (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0), 0);
    const purchaseGST = purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0);

    const expenses = await Expense.find({ ...baseFilter });
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    res.json({
      totalSales,
      totalPurchases,
      totalCOGS,
      grossProfit,
      totalGST,
      purchaseGST,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
      salesCount: sales.length,
      purchasesCount: purchases.length,
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

    const b2b = sales.filter((s) => s.customer && s.customerName !== 'Walk-in');
    const b2c = sales.filter((s) => !s.customer || s.customerName === 'Walk-in');

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

    // 3.1 Supply details
    const taxableValue = sales.reduce((s, sale) => s + (sale.taxableAmount || 0), 0);
    const totalGST = sales.reduce((s, sale) => s + (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0), 0);

    // 4. ITC
    const itcValue = purchases.reduce((s, p) => s + (p.taxableAmount || 0), 0);
    const itcGST = purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0);

    res.json({
      gstr3b: {
        supply: { taxableValue, centralTax: totalGST / 2, stateTax: totalGST / 2 },
        itc: { eligible: itcValue, centralTax: itcGST / 2, stateTax: itcGST / 2 },
        netGSTPayable: totalGST - itcGST,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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

    const [sales, creditNotes, purchases, purchaseReturns, transactions] = await Promise.all([
      Sale.find({ ...baseFilter, ...dateFilter, type: 'invoice' }).lean(),
      Sale.find({ ...baseFilter, ...dateFilter, type: 'credit_note' }).lean(),
      Purchase.find({ ...baseFilter, ...dateFilter }).lean(),
      PurchaseReturn.find({ ...baseFilter, returnDate: { $gte: startDate, $lte: endDate } }).lean(),
      Transaction.find({ ...baseFilter, date: { $gte: startDate, $lte: endDate } }).lean(),
    ]);

    // Helper
    const total = (arr, field) => arr.reduce((s, x) => s + (x[field] || 0), 0);

    // ── PART II: Outward Supplies ──────────────────────────────
    const b2b = sales.filter(s => s.customer && s.customerGst);
    const b2c = sales.filter(s => !s.customer || !s.customerGst || s.customerName === 'Walk-in');
    const exportsData = sales.filter(s => (s.placeOfSupply || '').toLowerCase().includes('outside') || (s.placeOfSupply || '').toLowerCase().includes('export'));
    const sezData = sales.filter(s => false);
    const deemedExports = sales.filter(s => false);

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
    const dnTotal = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };

    // Advances from Transactions (prepaid/received advances)
    const advances = transactions.filter(t => t.type === 'payment' && t.paymentMode === 'advance');
    const advancesTotal = { taxableValue: total(advances, 'amount') || 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };

    const part2 = {
      rateWiseB2B,
      rateWiseB2C,
      exports: { taxableValue: total(exportsData, 'taxableAmount'), cgst: total(exportsData, 'cgstTotal'), sgst: total(exportsData, 'sgstTotal'), igst: total(exportsData, 'igstTotal'), cess: total(exportsData, 'cessTotal') },
      sezSupplies: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 },
      deemedExports: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 },
      creditNotes: { count: creditNotes.length, ...cnTotal },
      debitNotes: { count: 0, ...dnTotal },
      advances: advancesTotal,
      adjustments: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 },
    };

    // ── PART III: Input Tax Credit ────────────────────────────
    const itcAvailed = {
      cgst: total(purchases, 'cgstTotal'),
      sgst: total(purchases, 'sgstTotal'),
      igst: total(purchases, 'igstTotal'),
      cess: 0,
    };
    const itcReversed = {
      cgst: total(purchaseReturns, 'cgstTotal'),
      sgst: total(purchaseReturns, 'sgstTotal'),
      igst: total(purchaseReturns, 'igstTotal'),
      cess: 0,
    };
    const netITC = {
      cgst: Math.max(0, itcAvailed.cgst - itcReversed.cgst),
      sgst: Math.max(0, itcAvailed.sgst - itcReversed.sgst),
      igst: Math.max(0, itcAvailed.igst - itcReversed.igst),
      cess: 0,
    };
    const ineligibleITC = { cgst: 0, sgst: 0, igst: 0, cess: 0 };

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

    const hsnMap = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        const hsn = item.hsn || 'GENERAL';
        if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, quantity: 0, taxableAmount: 0, gstAmount: 0 };
        hsnMap[hsn].quantity += item.quantity;
        hsnMap[hsn].taxableAmount += item.taxableAmount || 0;
        hsnMap[hsn].gstAmount += (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      });
    });

    res.json({ hsnSummary: Object.values(hsnMap) });
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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

    const transactions = await Transaction.find(filter).sort({ date: -1 });

    let runningBalance = 0;
    const entries = transactions.map((t) => {
      const isIn = t.type?.includes('in');
      runningBalance += isIn ? t.amount : -t.amount;
      return {
        _id: t._id,
        date: t.date,
        voucher: t.reference || '-',
        particular: t.description || '-',
        moneyIn: isIn ? t.amount : 0,
        moneyOut: isIn ? 0 : t.amount,
        balance: runningBalance,
        type: t.type,
      };
    });

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

    sales.forEach((s) => {
      const daysDiff = Math.floor((now - new Date(s.date)) / (1000 * 60 * 60 * 24));
      let bucket = '90+';
      if (daysDiff <= 30) bucket = '0-30';
      else if (daysDiff <= 60) bucket = '31-60';
      else if (daysDiff <= 90) bucket = '61-90';
      aging[bucket].push(s);
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
    const purchases = await Purchase.find(filter).sort({ date: -1 }).populate('supplier', 'name gstNumber');
    const b2b = purchases.filter((p) => p.supplier);
    const b2c = purchases.filter((p) => !p.supplier);
    const summary = {
      totalInvoices: purchases.length,
      totalTaxable: purchases.reduce((s, p) => s + (p.taxableAmount || 0), 0),
      totalGST: purchases.reduce((s, p) => s + (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0), 0),
      b2bCount: b2b.length,
      b2cCount: b2c.length,
    };
    res.json({ invoices: purchases, b2b, b2c, summary });
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
          if (!sacMap[hsn]) sacMap[hsn] = { sac: hsn, description: item.productName || 'SAC Service', quantity: 0, taxableAmount: 0, gstAmount: 0 };
          sacMap[hsn].quantity += item.quantity;
          sacMap[hsn].taxableAmount += item.taxableAmount || 0;
          sacMap[hsn].gstAmount += (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
        }
      });
    });
    res.json({ sacSummary: Object.values(sacMap) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const tdsTcsNotConfigured = (req, res) => {
  res.json({
    message: 'TDS/TCS Module Not Configured',
    enabled: false,
    entries: [],
    total: 0,
    sections: [],
  });
};

const getTDSReceivable = tdsTcsNotConfigured;
const getTDSPayable = tdsTcsNotConfigured;
const getTCSReceivable = tdsTcsNotConfigured;
const getForm27EQ = tdsTcsNotConfigured;

const getBankStatement = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter, type: /bank/ };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const transactions = await Transaction.find(filter).sort({ date: 1 });
    let runningBalance = 0;
    const entries = transactions.map((t) => {
      const isIn = t.type === 'bank_in';
      runningBalance += isIn ? t.amount : -t.amount;
      return {
        date: t.date,
        voucherType: t.type,
        voucherNo: t.reference || '-',
        partyName: t.partyName || '-',
        description: t.description || '-',
        debit: isIn ? 0 : t.amount,
        credit: isIn ? t.amount : 0,
        balance: runningBalance,
      };
    });
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
    const filter = { ...baseFilter, type: 'order' };
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
    const entries = await Expense.find(filter).sort({ date: -1 });
    res.json({ entries });
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
      if (endDate) dateFilter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
        date: p.date, txnType: 'Purchase', refNo: p.invoiceNumber,
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
    const movements = await StockMovement.find(filter)
      .sort({ date: -1 })
      .limit(500)
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
    res.json({ entries, total: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemDetail = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { search } = req.query;
    const filter = { ...baseFilter, isActive: true };
    if (search) filter.name = { $regex: search, $options: 'i' };
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
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
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
    const entries = await JournalEntry.find({
      ...filter,
      $or: [
        { debitAccount: { $in: loanAccountIds } },
        { creditAccount: { $in: loanAccountIds } },
      ],
    }).sort({ entryDate: -1 }).lean();
    const accountMap = {};
    loanAccounts.forEach(a => { accountMap[a._id.toString()] = a.name; });
    const result = entries.map((e, i) => {
      const isDebit = loanAccountIds.some(id => id.toString() === (e.debitAccount || {}).toString());
      return {
        date: e.entryDate,
        accountName: isDebit
          ? accountMap[e.debitAccount?.toString()] || '-'
          : accountMap[e.creditAccount?.toString()] || '-',
        emiNo: i + 1,
        amount: e.totalCredit || e.totalDebit || 0,
        balance: e.totalDebit - e.totalCredit || 0,
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
      const entries = await JournalEntry.find({
        ...baseFilter,
        $or: [
          { debitAccount: a._id },
          { creditAccount: a._id },
        ],
      }).lean();
      const totalGiven = entries.reduce((s, e) => {
        return s + (e.debitAccount?.toString() === a._id.toString() ? (e.totalDebit || 0) : 0);
      }, 0);
      const totalPaid = entries.reduce((s, e) => {
        return s + (e.creditAccount?.toString() === a._id.toString() ? (e.totalCredit || 0) : 0);
      }, 0);
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
    const products = await Product.find({ ...baseFilter }).lean();
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
    const products = await Product.find({
      ...baseFilter,
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

const getGSTR2AReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: new Date(startDate), $lt: end };
    }
    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name gstNumber')
      .sort({ date: -1 }).lean();

    const reconciliation = purchases.map(p => {
      const supplierGst = p.supplier?.gstNumber || '';
      const itcEligible = !!supplierGst && supplierGst.length === 15;
      return {
        _id: p._id,
        billNo: p.billNumber || p._id,
        date: p.date,
        supplierName: p.supplier?.name || 'Unknown',
        supplierGstin: supplierGst,
        taxableAmount: p.taxableAmount || 0,
        cgst: p.cgstTotal || 0,
        sgst: p.sgstTotal || 0,
        igst: p.igstTotal || 0,
        totalGst: (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0),
        totalAmount: p.totalAmount || 0,
        itcEligible,
        itcClaimable: itcEligible ? (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0) : 0,
        reversed: p.isReversed || false,
        matchingStatus: itcEligible ? 'matched' : 'unmatched',
      };
    });

    const summary = {
      totalInvoices: reconciliation.length,
      totalTaxable: reconciliation.reduce((s, r) => s + r.taxableAmount, 0),
      totalItcClaimable: reconciliation.reduce((s, r) => s + r.itcClaimable, 0),
      matchedCount: reconciliation.filter(r => r.matchingStatus === 'matched').length,
      unmatchedCount: reconciliation.filter(r => r.matchingStatus === 'unmatched').length,
    };
    res.json({ reconciliation, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
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
};
