const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Setting = require('../models/Setting');
const { recordStockMovement } = require('./stockController');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPurchases = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter };
    if (search) {
      filter.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        { 'items.productName': { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const total = await Purchase.countDocuments(filter);
    const purchases = await Purchase.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('supplier', 'name phone');
    res.json({ purchases, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const {
      supplier, supplierName, billNumber, date, dueDate, items,
      totalAmount, paidAmount, paymentStatus, paymentMethod, notes, isInterState,
    } = req.body;

    const setting = await Setting.findOne(baseFilter);
    const calcTaxOnMRP = setting?.preferences?.item?.calculateTaxOnMRP === true;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item required' });
    }

    // Calculate tax totals
    let taxableAmount = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const processedItems = items.map((item) => {
      const baseForTax = (calcTaxOnMRP && item.mrp) ? item.mrp * (item.quantity || 0) : (item.quantity || 0) * (item.rate || 0);
      const taxable = (item.quantity || 0) * (item.rate || 0);
      const gstHalf = isInterState ? 0 : baseForTax * ((item.gstRate || 0) / 100) / 2;
      const igstAmt = isInterState ? baseForTax * ((item.gstRate || 0) / 100) : 0;
      taxableAmount += taxable;
      cgstTotal += gstHalf;
      sgstTotal += gstHalf;
      igstTotal += igstAmt;
      return {
        product: item.product || undefined,
        productName: item.productName || '',
        quantity: item.quantity,
        rate: item.rate,
        amount: taxable + gstHalf + gstHalf + igstAmt,
        gstRate: item.gstRate || 0,
        taxableAmount: taxable,
        cgst: gstHalf,
        sgst: gstHalf,
        igst: igstAmt,
      };
    });

    // Auto-create supplier if needed
    let supplierId = supplier;
    if (supplierName && !supplier) {
      let existing = await Supplier.findOne({ ...baseFilter, name: supplierName });
      if (!existing) {
        existing = await Supplier.create({ user: req.user._id, business: req.businessId, name: supplierName });
      }
      supplierId = existing._id;
    }

    const purchase = await Purchase.create({
      user: req.user._id,
      business: req.businessId,
      supplier: supplierId,
      supplierName,
      billNumber,
      date,
      dueDate,
      items: processedItems,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalAmount,
      paidAmount: paidAmount || 0,
      remainingBalance: totalAmount - (paidAmount || 0),
      paymentStatus: paymentStatus || (paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'),
      paymentMethod: paymentMethod || 'cash',
      paymentDate: paidAmount > 0 ? (date || new Date()) : undefined,
      notes,
      isInterState: isInterState || false,
    });

    // Update stock + record movement
    for (const item of processedItems) {
      const prod = item.product
        ? await Product.findById(item.product)
        : await Product.findOne({ ...baseFilter, name: item.productName });

      if (prod) {
        await Product.findByIdAndUpdate(prod._id, { $inc: { stock: item.quantity } });
        await recordStockMovement({
          userId: req.user._id,
          businessId: req.businessId,
          productId: prod._id,
          productName: prod.name,
          type: 'purchase',
          quantity: item.quantity,
          rate: item.rate,
          totalAmount: item.amount,
          referenceType: 'purchase',
          referenceId: purchase._id,
          referenceNumber: billNumber || purchase._id,
          description: `Purchase from ${supplierName}`,
        });
      }
    }

    // Auto-update sale price if setting enabled
    if (setting?.preferences?.item?.updateSalePriceAuto) {
      for (const item of processedItems) {
        if (item.product && item.rate) {
          await Product.findByIdAndUpdate(item.product, { price: item.rate }).catch(() => {});
        }
      }
    }

    // Payment transaction
    if (paidAmount > 0) {
      const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';
      await Transaction.create({
        user: req.user._id,
        business: req.businessId,
        type: txnType,
        amount: paidAmount,
        description: `Payment to ${supplierName} - ${billNumber || purchase._id}`,
        date: date || new Date(),
        reference: billNumber || purchase._id,
        referenceModel: 'Purchase',
        referenceId: purchase._id,
        partyName: supplierName,
        partyType: 'supplier',
      });
    }

    // Auto-create journal entry for the purchase
    const purchaseAccount = await Account.findOne({ ...baseFilter, code: '5002' });
    const payable = await Account.findOne({ ...baseFilter, code: '2001' });
    if (purchaseAccount && payable) {
      const lines = [
        { account: purchaseAccount._id, accountName: purchaseAccount.name, accountType: purchaseAccount.type, debit: totalAmount, credit: 0 },
        { account: payable._id, accountName: payable.name, accountType: payable.type, debit: 0, credit: totalAmount - (paidAmount || 0) },
      ];
      if (paidAmount > 0) {
        const cash = await Account.findOne({ ...baseFilter, code: '1001' });
        if (cash) {
          lines[1].credit = totalAmount - paidAmount;
          lines.push({ account: cash._id, accountName: cash.name, accountType: cash.type, debit: 0, credit: paidAmount });
        }
      }
      try {
        await JournalEntry.create({
          user: req.user._id,
          business: req.businessId,
          entryNumber: `JE-PUR-${billNumber || purchase._id}`,
          entryDate: date || new Date(),
          referenceType: 'purchase',
          referenceId: purchase._id,
          lines,
          totalDebit: lines.reduce((s, l) => s + l.debit, 0),
          totalCredit: lines.reduce((s, l) => s + l.credit, 0),
          narration: `Purchase ${billNumber || ''} - ${supplierName}`,
          isPosted: true,
          postedAt: new Date(),
        });
        for (const line of lines) {
          const acc = await Account.findById(line.account);
          if (!acc) continue;
          const balanceChange = ['asset', 'expense'].includes(acc.type)
            ? line.debit - line.credit
            : line.credit - line.debit;
          await Account.findByIdAndUpdate(line.account, { $inc: { balance: balanceChange } });
        }
      } catch (jeErr) {
        console.error('Failed to create journal entry for purchase:', jeErr.message);
      }
    }

    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (purchase.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const body = req.body;
    const isPaymentOnly = Object.keys(body).every(k =>
      ['paidAmount', 'paymentMethod', 'paymentDate', 'paymentStatus'].includes(k)
    );

    if (!isPaymentOnly) {
      // Restore old stock (only when items may have changed)
      for (const item of purchase.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
        }
      }
    }

    // Build update set with whitelist
    const allowedFields = ['date', 'invoiceNumber', 'supplier', 'supplierName', 'items', 'totalAmount', 'taxAmount', 'discount', 'roundOff', 'paidAmount', 'paymentMethod', 'description', 'status'];
    const setFields = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) setFields[field] = body[field];
    }
    if (body.paidAmount !== undefined) {
      const total = purchase.totalAmount || body.totalAmount || 0;
      setFields.remainingBalance = Math.max(0, total - body.paidAmount);
      if (body.paidAmount >= total) setFields.paymentStatus = 'paid';
      else if (body.paidAmount > 0) setFields.paymentStatus = 'partial';
      else setFields.paymentStatus = 'unpaid';
      setFields.paymentDate = new Date();
    }

    const updated = await Purchase.findByIdAndUpdate(
      req.params.id,
      { $set: setFields },
      { new: true, runValidators: true }
    );

    if (!isPaymentOnly) {
      // Apply new stock
      for (const item of updated.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (purchase.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Delete purchase: reverse the stock addition that happened during creation
    for (const item of purchase.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }
    }

    // Reverse journal entry if one was created
    try {
      const JournalEntry = require('../models/JournalEntry');
      const Account = require('../models/Account');
      const journalEntry = await JournalEntry.findOne({ referenceType: 'Purchase', referenceId: purchase._id });
      if (journalEntry) {
        for (const line of journalEntry.lines) {
          if (line.account) {
            await Account.findByIdAndUpdate(line.account, {
              $inc: { balance: line.type === 'debit' ? -line.amount : line.amount },
            });
          }
        }
        await JournalEntry.findByIdAndDelete(journalEntry._id);
      }
    } catch (jeErr) {
      console.error('Failed to reverse journal entry on purchase delete:', jeErr.message);
    }

    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findById(req.params.id).populate('supplier', 'name phone');
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (purchase.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase };
