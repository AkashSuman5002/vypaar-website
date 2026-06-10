const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const Receipt = require('../models/Receipt');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const LoyaltyPoint = require('../models/LoyaltyPoint');
const { sendAutoMessage, sendPaymentMessage } = require('../services/messageService');
const { createNotification } = require('../controllers/notificationController');
const Transaction = require('../models/Transaction');
const { getBaseFilter, getSettingQuery, getCreateData } = require('../utils/queryHelper');

const getNextInvoiceNumber = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const setting = await Setting.findOne(getSettingQuery(req));
    const type = req.query.type || 'invoice';
    let prefix;
    if (type === 'order') prefix = setting?.preferences?.transaction?.saleOrderPrefix || 'SO-';
    else if (type === 'proforma') prefix = setting?.preferences?.transaction?.proformaPrefix || 'PRO-';
    else prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';

    const allSales = await Sale.find({ ...baseFilter, type }).select('invoiceNumber').lean();
    let maxNum = 0;
    for (const sale of allSales) {
      if (!sale.invoiceNumber) continue;
      const numStr = sale.invoiceNumber.startsWith(prefix)
        ? sale.invoiceNumber.slice(prefix.length)
        : sale.invoiceNumber;
      const num = parseInt(numStr);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const nextNum = maxNum + 1;
    const invoiceNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;
    res.json({ invoiceNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, status, paymentStatus, type, customer, paymentMethod, dateFrom, dateTo, branch, sortBy = 'date', sortOrder = 'desc' } = req.query;
    const filter = { ...baseFilter };

    if (type) {
      if (type.includes(',')) filter.type = { $in: type.split(',') };
      else filter.type = type;
    } else filter.type = 'invoice';
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (customer) filter.customer = customer;
    if (branch) filter.branch = branch;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { invoiceNumber: { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { customerPhone: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    if (paymentMethod) {
      filter['payments.mode'] = paymentMethod;
    }

    const sortObj = {};
    sortObj[sortBy === 'amount' ? 'totalAmount' : sortBy === 'invoiceNumber' ? 'invoiceNumber' : 'date'] = sortOrder === 'asc' ? 1 : -1;

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .populate('customer', 'name phone')
      .populate('parentSale', 'invoiceNumber')
      .sort(sortObj)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    let dashboardData = { totalSales: 0, totalPaid: 0, totalOutstanding: 0, count: 0 };
    if (type === 'invoice' || !type) {
      const allMatching = await Sale.find(filter).select('totalAmount paidAmount remainingBalance').lean();
      if (allMatching.length > 0) {
        dashboardData = {
          totalSales: allMatching.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          totalPaid: allMatching.reduce((sum, s) => sum + (s.paidAmount || 0), 0),
          totalOutstanding: allMatching.reduce((sum, s) => sum + (s.remainingBalance || 0), 0),
          count: allMatching.length,
        };
      }
    }

    res.json({
      sales,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      dashboard: dashboardData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSaleById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ ...baseFilter, _id: req.params.id }).populate('customer', 'name phone email address gstNumber openingBalance creditLimit');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let {
      invoiceNumber, type, status, date, dueDate, referenceNumber, salesPerson,
      customer, customerName, customerPhone, customerEmail, customerGst,
      customerType, customerState, billingAddress, shippingAddress,
      placeOfSupply, isInterState, branch, warehouse,
      items, totalItems, totalQuantity,
      taxableAmount, discountTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, taxTotal,
      shippingCharge, packingCharge, freightCharge, loadingCharge, otherCharge,
      additionalChargesTotal, discountOnInvoice,
      roundOff, roundingMethod: roundingMethodInput,
      totalAmount, payments, paidAmount, remainingBalance, paymentStatus,
      eWayBill, transportMode, vehicleNo, poNumber,
      notes, internalNotes, termsConditions,
    } = req.body;

    const setting = await Setting.findOne(getSettingQuery(req));
    const compositionScheme = setting?.preferences?.taxes?.compositionScheme === true;
    const enableTCS = setting?.preferences?.taxes?.enableTCS === true;
    const enableTDS = setting?.preferences?.taxes?.tdsRate > 0;
    const enableGST = setting?.preferences?.taxes?.enableGST !== false;
    const reverseCharge = setting?.preferences?.taxes?.reverseCharge === true;
    const stopOnNegative = setting?.preferences?.general?.stopSaleOnNegativeStock === true;
    const stockMaintenance = setting?.preferences?.item?.stockMaintenance !== false;
    const cashSaleByDefault = setting?.preferences?.transaction?.cashSaleByDefault === true;
    const roundOffEnabled = setting?.preferences?.transaction?.roundOffTotal === true;
    const roundingMethod = roundingMethodInput || setting?.preferences?.transaction?.roundingMethod || 'nearest';

    for (const item of items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        if (!prod) return res.status(400).json({ message: `Product not found: ${item.productName}` });
        if (stopOnNegative && prod.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}, Requested: ${item.quantity}` });
        }
      }
    }

    // Composition scheme: no GST charged
    if (compositionScheme) {
      for (const item of items) {
        item.gstRate = 0;
        item.cgst = 0;
        item.sgst = 0;
        item.igst = 0;
      }
    }

    const allowJE = setting?.preferences?.accounting?.allowJournalEntries !== false;

    // Apply default terms & conditions from settings if not provided
    if (!termsConditions && setting?.preferences?.transaction?.termsAndConditions) {
      termsConditions = setting.preferences.transaction.termsAndConditions;
    }

    // Apply round off from settings if enabled
    if (roundOffEnabled && totalAmount && !roundOff) {
      const method = roundingMethod || 'nearest';
      if (method === 'nearest') {
        roundOff = Math.round(totalAmount) - totalAmount;
      } else if (method === 'up') {
        roundOff = Math.ceil(totalAmount) - totalAmount;
      } else if (method === 'down') {
        roundOff = Math.floor(totalAmount) - totalAmount;
      }
      if (roundOff !== 0) totalAmount = Math.round(totalAmount);
    }

    if (invoiceNumber) {
      const exists = await Sale.findOne({ ...baseFilter, invoiceNumber, type: { $in: [type || 'invoice', 'order', 'quotation', 'challan', 'estimate', 'proforma'] } });
      if (exists) {
        let prefix;
        if (type === 'order') prefix = setting?.preferences?.transaction?.saleOrderPrefix || 'SO-';
        else if (type === 'proforma') prefix = setting?.preferences?.transaction?.proformaPrefix || 'PRO-';
        else prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';
        const allSales = await Sale.find({ ...baseFilter, type: type || 'invoice' }).select('invoiceNumber').lean();
        let maxNum = 0;
        for (const s of allSales) {
          if (!s.invoiceNumber) continue;
          const numStr = s.invoiceNumber.startsWith(prefix) ? s.invoiceNumber.slice(prefix.length) : s.invoiceNumber;
          const num = parseInt(numStr);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        invoiceNumber = `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
      }
    }

    let tcsAmount = 0;
    let tdsAmount = 0;
    if (enableTCS) {
      const tcsRate = setting?.preferences?.taxes?.tcsRate || 1;
      tcsAmount = (taxableAmount || totalAmount || 0) * tcsRate / 100;
    }
    if (enableTDS) {
      const tdsRate = setting?.preferences?.taxes?.tdsRate || 1;
      tdsAmount = (taxableAmount || totalAmount || 0) * tdsRate / 100;
    }

    const sale = await Sale.create({
      user: req.user._id,
      business: req.businessId,
      invoiceNumber, type: type || 'invoice', status: status || 'confirmed',
      date, dueDate, referenceNumber, salesPerson,
      customer: customer || null, customerName, customerPhone, customerEmail, customerGst,
      customerType, customerState, billingAddress, shippingAddress,
      placeOfSupply, isInterState, reverseCharge: req.body.reverseCharge || false, branch, warehouse,
      items, totalItems, totalQuantity,
      taxableAmount, discountTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, taxTotal,
      shippingCharge, packingCharge, freightCharge, loadingCharge, otherCharge,
      additionalChargesTotal, discountOnInvoice,
      roundOff, roundOffEnabled, roundingMethod,
      totalAmount,
      payments: payments || [],
      paidAmount: paidAmount || 0,
      remainingBalance: remainingBalance || totalAmount,
      paymentStatus: paymentStatus || 'unpaid',
      eWayBill, transportMode, vehicleNo, poNumber,
      notes, internalNotes, termsConditions,
      tcsAmount, tdsAmount,
      createdBy: req.user.name || req.user.email,
    });

    for (const item of items) {
      if (item.product && sale.type === 'invoice' && sale.status !== 'draft' && stockMaintenance) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod.stock;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: -item.quantity } }, { new: true });
        await StockMovement.create({
          user: req.user._id,
          business: req.businessId,
          product: item.product,
          productName: item.productName,
          type: 'sale',
          quantity: -item.quantity,
          balanceBefore: balBefore,
          balanceAfter: balBefore - item.quantity,
          rate: item.rate,
          totalAmount: item.amount,
          referenceType: 'Sale',
          referenceId: sale._id,
          referenceNumber: invoiceNumber,
          description: `Sale invoice ${invoiceNumber}`,
          date: date || new Date(),
        });
        if (prod && (balBefore - item.quantity) <= (prod.minStock || 0) && prod.minStock > 0) {
          createNotification(req.user._id, 'low_stock', 'Low Stock Alert',
            `${item.productName || prod.name} is low on stock (${balBefore - item.quantity} remaining, min: ${prod.minStock})`,
            prod._id, 'Product'
          ).catch(() => {});
        }
      }
    }

    if (paidAmount > 0) {
      await Transaction.create({
        user: req.user._id,
        business: req.businessId,
        type: 'cash_in',
        amount: paidAmount,
        description: `Payment received - ${invoiceNumber} from ${customerName || 'Walk-in'}`,
        date: date || new Date(),
        reference: invoiceNumber,
        referenceModel: 'Sale',
        referenceId: sale._id,
        partyName: customerName || 'Walk-in',
        partyType: 'customer',
      });
    }

    // Auto-create journal entry for the sale (if allowed)
    if (allowJE) {
    const salesRevenue = await Account.findOne({ ...baseFilter, code: '4001' });
    const receivable = await Account.findOne({ ...baseFilter, code: '1101' });
    if (salesRevenue && receivable) {
      const debitLine = { account: receivable._id, accountName: receivable.name, accountType: receivable.type, debit: remainingBalance || totalAmount, credit: 0 };
      const creditLine = { account: salesRevenue._id, accountName: salesRevenue.name, accountType: salesRevenue.type, debit: 0, credit: totalAmount };
      const lines = [debitLine, creditLine];
      if (paidAmount > 0) {
        const cash = await Account.findOne({ ...baseFilter, code: '1001' });
        if (cash) {
          debitLine.debit = remainingBalance;
          if (paidAmount > 0) {
            lines.push({ account: cash._id, accountName: cash.name, accountType: cash.type, debit: paidAmount, credit: 0 });
          }
        }
      }
      try {
        await JournalEntry.create({
          user: req.user._id,
          business: req.businessId,
          entryNumber: `JE-SALE-${invoiceNumber}`,
          entryDate: date || new Date(),
          referenceType: 'sale',
          referenceId: sale._id,
          lines,
          totalDebit: lines.reduce((s, l) => s + l.debit, 0),
          totalCredit: lines.reduce((s, l) => s + l.credit, 0),
          narration: `Sale ${invoiceNumber} - ${customerName || 'Walk-in'}`,
          isPosted: true,
          postedAt: new Date(),
        });
        for (const line of lines) {
          const acc = await Account.findOne({ _id: line.account, user: req.user._id });
          if (!acc) continue;
          const balanceChange = ['asset', 'expense'].includes(acc.type)
            ? line.debit - line.credit
            : line.credit - line.debit;
          await Account.findOneAndUpdate({ _id: line.account, user: req.user._id }, { $inc: { balance: balanceChange } }, { new: true });
        }
      } catch (jeErr) {
        console.error('Failed to create journal entry for sale:', jeErr.message);
      }
    }
    }

    if (customer) {
      await Customer.findOneAndUpdate({ _id: customer, user: req.user._id }, { $inc: { openingBalance: remainingBalance || totalAmount } }, { new: true });
    }

    // Earn loyalty points
    if (customer) {
      const loyaltySetting = await Setting.findOne(getSettingQuery(req));
      if (loyaltySetting?.preferences?.party?.enableLoyalty) {
        const earningRate = 10;
        const pointsEarned = Math.floor((paidAmount || totalAmount) / earningRate);
        if (pointsEarned > 0) {
          const lastEntry = await LoyaltyPoint.findOne({ ...baseFilter, customer }).sort({ createdAt: -1 });
          const currentBalance = lastEntry ? lastEntry.balance : 0;
          await LoyaltyPoint.create({
            user: req.user._id,
            business: req.businessId,
            customer, customerName,
            transaction: sale._id, transactionType: 'earn',
            points: pointsEarned, balance: currentBalance + pointsEarned,
            description: `Points earned from sale ${invoiceNumber}`,
            referenceNumber: invoiceNumber,
          });
          await Customer.findOneAndUpdate({ _id: customer, user: req.user._id }, { $set: { loyaltyPoints: currentBalance + pointsEarned } }, { new: true });
        }
      }
    }

    // Send WhatsApp auto-message
    sendAutoMessage(req.user._id, req.businessId, type || 'invoice', {
      customerName,
      customerPhone,
      invoiceNumber,
      invoiceId: sale._id,
      date: date || new Date(),
      totalAmount,
      remainingBalance: remainingBalance || totalAmount,
    }).catch(() => {});

    createNotification(req.user._id, 'new_sale', 'New Sale Created',
      `Invoice ${invoiceNumber} for Rs.${totalAmount.toFixed(2)}${customerName ? ` - ${customerName}` : ''}`,
      sale._id, 'Sale'
    ).catch(() => {});

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const oldPaidAmount = sale.paidAmount;
    const itemsChanged = req.body.items && JSON.stringify(req.body.items) !== JSON.stringify(sale.items);

    if (itemsChanged && (sale.type === 'invoice' || sale.type === 'challan') && sale.status !== 'draft') {
      // Restore old stock
      for (const item of sale.items) {
        if (item.product) {
          await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: item.quantity } }, { new: true });
        }
      }
    }

    const fields = ['invoiceNumber', 'type', 'status', 'date', 'dueDate', 'referenceNumber', 'salesPerson',
      'customer', 'customerName', 'customerPhone', 'customerEmail', 'customerGst',
      'customerType', 'customerState', 'billingAddress', 'shippingAddress', 'placeOfSupply', 'isInterState', 'reverseCharge',
      'branch', 'warehouse', 'items', 'totalItems', 'totalQuantity',
      'taxableAmount', 'discountTotal', 'cgstTotal', 'sgstTotal', 'igstTotal', 'cessTotal', 'taxTotal',
      'shippingCharge', 'packingCharge', 'freightCharge', 'loadingCharge', 'otherCharge',
      'additionalChargesTotal', 'discountOnInvoice',
      'roundOff', 'roundOffEnabled', 'roundingMethod',
      'totalAmount', 'payments', 'paidAmount', 'remainingBalance', 'paymentStatus',
      'eWayBill', 'transportMode', 'vehicleNo', 'poNumber',
      'notes', 'internalNotes', 'termsConditions', 'deliveryStatus'];

    fields.forEach(f => {
      if (req.body[f] !== undefined) sale[f] = req.body[f];
    });
    sale.updatedBy = req.user.name || req.user.email;

    if (itemsChanged && (sale.type === 'invoice' || sale.type === 'challan') && sale.status !== 'draft') {
      // Apply new stock
      for (const item of sale.items) {
        if (item.product) {
          const prod = await Product.findOne({ _id: item.product, user: req.user._id });
          const balBefore = prod ? prod.stock : 0;
          await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: -item.quantity } }, { new: true });
          const StockMovement = require('../models/StockMovement');
          await StockMovement.create({
            user: req.user._id,
            business: req.businessId,
            product: item.product, productName: item.productName,
            type: 'sale_adjustment', quantity: -item.quantity,
            balanceBefore: balBefore, balanceAfter: balBefore - item.quantity,
            rate: item.rate, totalAmount: item.amount,
            referenceType: 'Sale', referenceId: sale._id,
            referenceNumber: sale.invoiceNumber,
            description: `Stock adjustment on sale update - ${sale.invoiceNumber}`,
            date: new Date(),
          });
        }
      }
    }

    const additionalPaid = sale.paidAmount - oldPaidAmount;
    if (additionalPaid > 0) {
      await Transaction.create({
        user: req.user._id,
        business: req.businessId,
        type: 'cash_in',
        amount: additionalPaid,
        description: `Payment received - ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
        date: new Date(),
        reference: sale.invoiceNumber,
        referenceModel: 'Sale',
        referenceId: sale._id,
        partyName: sale.customerName || 'Walk-in',
        partyType: 'customer',
      });
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    for (const item of sale.items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod ? prod.stock : 0;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: item.quantity } }, { new: true });
        await StockMovement.create({
          user: req.user._id,
          business: req.businessId,
          product: item.product,
          productName: item.productName,
          type: 'return',
          quantity: item.quantity,
          balanceBefore: balBefore,
          balanceAfter: balBefore + item.quantity,
          rate: item.rate,
          totalAmount: item.amount,
          referenceType: 'Sale',
          referenceId: sale._id,
          referenceNumber: sale.invoiceNumber,
          description: `Sale deleted - ${sale.invoiceNumber} - stock restored`,
          date: new Date(),
        });
      }
    }

    if (sale.customer) {
      await Customer.findOneAndUpdate({ _id: sale.customer, user: req.user._id }, { $inc: { openingBalance: -sale.remainingBalance } }, { new: true });
    }

    // Reverse journal entry if one was created
    try {
      const journalEntry = await JournalEntry.findOne({ referenceType: 'Sale', referenceId: sale._id, user: req.user._id });
      if (journalEntry) {
        for (const line of journalEntry.lines) {
          if (line.account) {
            await Account.findOneAndUpdate({ _id: line.account, user: req.user._id }, {
              $inc: { balance: line.type === 'debit' ? -line.amount : line.amount },
            }, { new: true });
          }
        }
        await JournalEntry.findOneAndDelete({ _id: journalEntry._id, user: req.user._id });
      }
    } catch (jeErr) {
      console.error('Failed to reverse journal entry on sale delete:', jeErr.message);
    }

    sale.status = 'cancelled';
    await sale.save();
    res.json({ message: 'Sale cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const duplicateSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const original = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!original) return res.status(404).json({ message: 'Sale not found' });

    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';
    const lastSale = await Sale.findOne({ ...baseFilter, type: 'invoice' }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastSale && lastSale.invoiceNumber) {
      const num = parseInt(lastSale.invoiceNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const newInvoiceNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    const saleData = original.toObject();
    delete saleData._id;
    delete saleData.__v;
    delete saleData.createdAt;
    delete saleData.updatedAt;
    saleData.invoiceNumber = newInvoiceNumber;
    saleData.date = new Date();
    saleData.status = 'draft';
    saleData.paidAmount = 0;
    saleData.remainingBalance = saleData.totalAmount;
    saleData.paymentStatus = 'unpaid';
    saleData.payments = [];
    saleData.parentSale = original._id;
    saleData.createdBy = req.user.name || req.user.email;
    saleData.business = req.businessId;

    const sale = await Sale.create(saleData);
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const convertToReturn = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const original = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!original) return res.status(404).json({ message: 'Sale not found' });

    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.transaction?.creditNotePrefix || 'CN-';
    const lastSale = await Sale.findOne({ ...baseFilter, type: 'credit_note' }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastSale && lastSale.invoiceNumber) {
      const num = parseInt(lastSale.invoiceNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const creditNoteNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    const returnData = original.toObject();
    delete returnData._id;
    delete returnData.__v;
    delete returnData.createdAt;
    delete returnData.updatedAt;
    returnData.invoiceNumber = creditNoteNumber;
    returnData.type = 'credit_note';
    returnData.date = new Date();
    returnData.parentSale = original._id;
    returnData.paidAmount = 0;
    returnData.remainingBalance = 0;
    returnData.paymentStatus = 'paid';
    returnData.status = 'confirmed';

    for (const item of returnData.items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod ? prod.stock : 0;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: item.quantity } }, { new: true });
        await StockMovement.create({
          user: req.user._id,
          business: req.businessId,
          product: item.product,
          productName: item.productName,
          type: 'return',
          quantity: item.quantity,
          balanceBefore: balBefore,
          balanceAfter: balBefore + item.quantity,
          rate: item.rate,
          totalAmount: item.amount,
          referenceType: 'Sale',
          referenceId: null,
          referenceNumber: creditNoteNumber,
          description: `Credit note ${creditNoteNumber} for ${original.invoiceNumber}`,
          date: new Date(),
        });
      }
    }

    returnData.business = req.businessId;
    const creditNote = await Sale.create(returnData);

    await Transaction.create({
      user: req.user._id,
      business: req.businessId,
      type: 'cash_out',
      amount: original.totalAmount,
      description: `Credit note ${creditNoteNumber} - Return against ${original.invoiceNumber}`,
      date: new Date(),
      reference: creditNoteNumber,
      referenceModel: 'Sale',
      referenceId: creditNote._id,
      partyName: original.customerName || 'Walk-in',
      partyType: 'customer',
    });

    // Send WhatsApp credit note message
    sendAutoMessage(req.user._id, req.businessId, 'credit_note', {
      customerName: original.customerName || 'Walk-in',
      customerPhone: original.customerPhone || '',
      invoiceNumber: creditNoteNumber,
      invoiceId: creditNote._id,
      date: new Date(),
      totalAmount: original.totalAmount,
      remainingBalance: 0,
    }).catch(() => {});

    res.status(201).json(creditNote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const convertToChallan = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const original = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!original) return res.status(404).json({ message: 'Sale not found' });

    const setting = await Setting.findOne(getSettingQuery(req));
    const goodsReturn = setting?.preferences?.general?.goodsReturnOnDC !== false;
    const prefix = setting?.preferences?.transaction?.deliveryChallanPrefix || 'DC-';
    const lastChallan = await Sale.findOne({ ...baseFilter, type: 'challan' }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastChallan && lastChallan.invoiceNumber) {
      const num = parseInt(lastChallan.invoiceNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const challanNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    const challanData = original.toObject();
    delete challanData._id;
    delete challanData.__v;
    delete challanData.createdAt;
    delete challanData.updatedAt;
    challanData.invoiceNumber = challanNumber;
    challanData.type = 'challan';
    challanData.date = new Date();
    challanData.parentSale = original._id;
    challanData.paidAmount = 0;
    challanData.remainingBalance = 0;
    challanData.paymentStatus = 'paid';
    challanData.status = 'confirmed';
    challanData.goodsReturnEnabled = goodsReturn;
    if (setting?.preferences?.general?.printAmountOnDC === false) {
      challanData.totalAmount = 0;
      challanData.paidAmount = 0;
      challanData.remainingBalance = 0;
      challanData.items = challanData.items.map(item => ({ ...item, rate: 0, amount: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0 }));
    }
    challanData.deliveryStatus = 'pending';
    challanData.totalAmount = 0;
    challanData.business = req.businessId;

    const challan = await Sale.create(challanData);

    // Send WhatsApp challan message
    sendAutoMessage(req.user._id, req.businessId, 'challan', {
      customerName: original.customerName || 'Walk-in',
      customerPhone: original.customerPhone || '',
      invoiceNumber: challanNumber,
      invoiceId: challan._id,
      date: new Date(),
      totalAmount: 0,
      remainingBalance: 0,
    }).catch(() => {});

    res.status(201).json(challan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const convertToEstimate = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const original = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!original) return res.status(404).json({ message: 'Sale not found' });

    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.transaction?.estimatePrefix || 'EST-';
    const lastEst = await Sale.findOne({ ...baseFilter, type: 'estimate' }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastEst && lastEst.invoiceNumber) {
      const num = parseInt(lastEst.invoiceNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const estNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    const estData = original.toObject();
    delete estData._id;
    delete estData.__v;
    delete estData.createdAt;
    delete estData.updatedAt;
    estData.invoiceNumber = estNumber;
    estData.type = 'estimate';
    estData.date = new Date();
    estData.parentSale = original._id;
    estData.status = 'draft';
    estData.business = req.businessId;

    const estimate = await Sale.create(estData);

    // Send WhatsApp estimate message
    sendAutoMessage(req.user._id, req.businessId, 'estimate', {
      customerName: original.customerName || 'Walk-in',
      customerPhone: original.customerPhone || '',
      invoiceNumber: estNumber,
      invoiceId: estimate._id,
      date: new Date(),
      totalAmount: original.totalAmount,
      remainingBalance: original.remainingBalance,
    }).catch(() => {});

    res.status(201).json(estimate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSalesByCustomer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sales = await Sale.find({ ...baseFilter, customer: req.params.customerId, type: 'invoice', status: { $ne: 'cancelled' } })
      .sort({ date: -1 }).lean();
    const totalOutstanding = sales.reduce((s, x) => s + x.remainingBalance, 0);
    res.json({ sales, totalOutstanding });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const convertToInvoice = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const original = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!original) return res.status(404).json({ message: 'Sale not found' });

    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';
    const stopOnNegative = setting?.preferences?.general?.stopSaleOnNegativeStock === true;
    const lastSale = await Sale.findOne({ ...baseFilter, type: 'invoice' }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastSale && lastSale.invoiceNumber) {
      const num = parseInt(lastSale.invoiceNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const invoiceNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    const invoiceData = original.toObject();
    delete invoiceData._id;
    delete invoiceData.__v;
    delete invoiceData.createdAt;
    delete invoiceData.updatedAt;
    invoiceData.invoiceNumber = invoiceNumber;
    invoiceData.type = 'invoice';
    invoiceData.date = new Date();
    invoiceData.parentSale = original._id;
    invoiceData.status = 'confirmed';

    for (const item of invoiceData.items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        if (!prod) return res.status(400).json({ message: `Product not found: ${item.productName}` });
        if (stopOnNegative && prod.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}, Requested: ${item.quantity}` });
        }
      }
    }

    for (const item of invoiceData.items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod.stock;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: -item.quantity } }, { new: true });
        await StockMovement.create({
          user: req.user._id,
          business: req.businessId,
          product: item.product, productName: item.productName,
          type: 'sale', quantity: -item.quantity, balanceBefore: balBefore,
          balanceAfter: balBefore - item.quantity, rate: item.rate, totalAmount: item.amount,
          referenceType: 'Sale', referenceNumber: invoiceNumber,
          description: `Invoice ${invoiceNumber} (converted from ${original.type} ${original.invoiceNumber})`,
          date: new Date(),
        });
      }
    }

    invoiceData.business = req.businessId;
    const invoice = await Sale.create(invoiceData);

    if (invoiceData.customer) {
      await Customer.findOneAndUpdate({ _id: invoiceData.customer, user: req.user._id }, { $inc: { openingBalance: invoiceData.remainingBalance || invoiceData.totalAmount } }, { new: true });
    }

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const receivePayment = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const { amount, mode, transactionNo, bankName, chequeNo, referenceNo, date, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid payment amount' });
    if (amount > sale.remainingBalance) return res.status(400).json({ message: `Amount exceeds remaining balance of ${sale.remainingBalance}` });

    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.transaction?.paymentInPrefix || setting?.receiptPrefix || 'RCP-';
    const lastReceipt = await Receipt.findOne(baseFilter).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastReceipt && lastReceipt.receiptNumber) {
      const num = parseInt(lastReceipt.receiptNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    const receiptNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

    sale.paidAmount = (sale.paidAmount || 0) + Number(amount);
    sale.remainingBalance = Math.max(0, sale.totalAmount - sale.paidAmount);
    sale.paymentStatus = sale.paidAmount >= sale.totalAmount ? 'paid' : 'partial';
    if (!sale.payments) sale.payments = [];
    sale.payments.push({ mode: mode || 'cash', amount: Number(amount), date: date || new Date(), transactionNo, bankName, chequeNo, referenceNo });
    await sale.save();

    const receipt = await Receipt.create({
      user: req.user._id,
      business: req.businessId,
      receiptNumber, sale: sale._id, invoiceNumber: sale.invoiceNumber,
      customer: sale.customer, customerName: sale.customerName || 'Walk-in',
      date: date || new Date(), amount: Number(amount), mode: mode || 'cash',
      transactionNo, bankName, chequeNo, referenceNo, notes,
      createdBy: req.user.name || req.user.email,
    });

    await Transaction.create({
      user: req.user._id,
      business: req.businessId,
      type: 'cash_in', amount: Number(amount),
      description: `Payment received - ${receiptNumber} for ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
      date: date || new Date(), reference: receiptNumber, referenceModel: 'Receipt', referenceId: receipt._id,
      partyName: sale.customerName || 'Walk-in', partyType: 'customer',
    });

    // Send WhatsApp payment message
    sendPaymentMessage(req.user._id, req.businessId, {
      customerName: sale.customerName || 'Walk-in',
      customerPhone: sale.customerPhone || '',
      invoiceNumber: sale.invoiceNumber,
      invoiceId: sale._id,
      receiptNumber,
      receiptId: receipt._id,
      totalAmount: Number(amount),
      remainingBalance: sale.remainingBalance,
      paymentMode: mode || 'cash',
      date: date || new Date(),
    }).catch(() => {});

    createNotification(req.user._id, 'new_sale', 'Sale with Payment',
      `Invoice ${sale.invoiceNumber} for Rs.${Number(amount).toFixed(2)}${sale.customerName ? ` - ${sale.customerName}` : ''}`,
      sale._id, 'Sale'
    ).catch(() => {});

    if (Number(amount) > 0) {
      createNotification(req.user._id, 'payment_received', 'Payment Received',
        `Rs.${Number(amount).toFixed(2)} received for Invoice ${sale.invoiceNumber}`,
        receipt._id, 'Receipt'
      ).catch(() => {});
    }

    res.status(201).json({ sale, receipt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSales, getSaleById, createSale, updateSale, deleteSale,
  getNextInvoiceNumber, duplicateSale, convertToReturn, convertToChallan, convertToEstimate,
  getSalesByCustomer, convertToInvoice, receivePayment,
};
