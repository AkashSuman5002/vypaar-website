const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Transaction = require('../models/Transaction');
const { getBaseFilter } = require('../utils/queryHelper');

const getCustomerLedger = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customer = await Customer.findOne({ _id: req.params.id, ...baseFilter });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const sales = await Sale.find({ customer: customer._id, ...baseFilter }).sort({ date: 1 });
    const transactions = await Transaction.find({
      ...baseFilter,
      reference: { $in: sales.map(s => s.invoiceNumber) },
    }).sort({ date: 1 });

    const entries = [];
    let runningBalance = customer.openingBalance || 0;

    entries.push({
      date: customer.createdAt,
      type: 'Opening Balance',
      reference: 'OB',
      debit: runningBalance > 0 ? runningBalance : 0,
      credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
      balance: runningBalance,
    });

    const allAmounts = [];
    let lastDate = null;

    for (const sale of sales) {
      runningBalance += sale.totalAmount;
      allAmounts.push(sale.totalAmount);
      lastDate = sale.date;
      entries.push({
        date: sale.date,
        type: 'Invoice',
        reference: sale.invoiceNumber,
        debit: sale.totalAmount,
        credit: 0,
        balance: runningBalance,
      });

      const paid = sale.paidAmount;
      if (paid > 0) {
        runningBalance -= paid;
        allAmounts.push(paid);
        entries.push({
          date: sale.paymentDate || sale.date,
          type: 'Payment Received',
          reference: sale.invoiceNumber,
          debit: 0,
          credit: paid,
          balance: runningBalance,
        });
      }
    }

    const totalSales = sales.reduce((s, x) => s + x.totalAmount, 0);
    const totalPayments = sales.reduce((s, x) => s + x.paidAmount, 0);
    const outstandingDue = totalSales - totalPayments + (customer.openingBalance || 0);

    res.json({
      customer,
      entries,
      openingBalance: customer.openingBalance || 0,
      totalSales,
      totalPayments,
      outstandingDue,
      analytics: {
        lastTransactionDate: lastDate,
        totalTransactions: entries.filter(e => e.type !== 'Opening Balance').length,
        averageTransactionValue: allAmounts.length > 0 ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length : 0,
        largestTransaction: allAmounts.length > 0 ? Math.max(...allAmounts) : 0,
        invoiceCount: sales.length,
        paymentCount: sales.filter(s => s.paidAmount > 0).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSupplierLedger = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const supplier = await Supplier.findOne({ _id: req.params.id, ...baseFilter });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const purchases = await Purchase.find({ supplier: supplier._id, ...baseFilter }).sort({ date: 1 });

    const entries = [];
    let runningBalance = supplier.openingBalance || 0;

    const obIsDebit = runningBalance < 0;

    entries.push({
      date: supplier.createdAt,
      type: 'Opening Balance',
      reference: 'OB',
      debit: obIsDebit ? Math.abs(runningBalance) : 0,
      credit: !obIsDebit ? runningBalance : 0,
      balance: runningBalance,
    });

    const allAmounts = [];
    let lastDate = null;

    for (const purchase of purchases) {
      const amt = purchase.totalAmount || purchase.amount || 0;
      runningBalance += amt;
      allAmounts.push(amt);
      lastDate = purchase.date;
      entries.push({
        date: purchase.date,
        type: 'Purchase',
        reference: purchase._id.toString().slice(-6).toUpperCase(),
        debit: 0,
        credit: amt,
        balance: runningBalance,
      });
    }

    const totalPurchases = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const outstandingPayable = totalPurchases + (supplier.openingBalance || 0);

    res.json({
      supplier,
      entries,
      openingBalance: supplier.openingBalance || 0,
      totalPurchases,
      outstandingPayable,
      analytics: {
        lastTransactionDate: lastDate,
        totalTransactions: entries.filter(e => e.type !== 'Opening Balance').length,
        averageTransactionValue: allAmounts.length > 0 ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length : 0,
        largestTransaction: allAmounts.length > 0 ? Math.max(...allAmounts) : 0,
        purchaseCount: purchases.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCustomerLedger, getSupplierLedger };
