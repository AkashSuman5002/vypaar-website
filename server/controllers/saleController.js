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
const { sendEmailNotification } = require('../services/emailService');
const { sendSMSNotification } = require('../services/smsService');
const Transaction = require('../models/Transaction');
const { getBaseFilter, getSettingQuery, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');

const extractStateCode = (gstin) => {
  if (!gstin || gstin.length < 2) return '';
  return gstin.substring(0, 2);
};

const stateNameToCode = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08',
  'uttar pradesh': '09', 'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12',
  'nagaland': '13', 'manipur': '14', 'mizoram': '15', 'tripura': '16',
  'meghalaya': '17', 'assam': '18', 'west bengal': '19', 'jharkhand': '20',
  'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'andhra pradesh (old)': '28', 'telangana': '36', 'andhra pradesh': '37',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32',
  'tamil nadu': '33', 'puducherry': '34', 'andaman and nicobar islands': '35',
};

const extractStateCodeFromName = (name) => {
  if (!name) return '';
  const cleaned = name.replace(/\d+/g, '').trim().toLowerCase();
  if (stateNameToCode[cleaned]) return stateNameToCode[cleaned];
  if (/^\d{2}$/.test(cleaned)) return cleaned;
  for (const [state, code] of Object.entries(stateNameToCode)) {
    if (cleaned.includes(state) || state.includes(cleaned)) return code;
  }
  return '';
};

const getNextInvoiceNumber = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const setting = await Setting.findOne(getSettingQuery(req));
    const type = req.query.type || 'invoice';
    const invoiceNoMode = setting?.preferences?.transaction?.invoiceNo;
    if (invoiceNoMode === 'Manual') {
      return res.json({ invoiceNumber: '', manualMode: true });
    }
    let prefix;
    if (type === 'invoice') prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';
    else if (type === 'estimate') prefix = setting?.preferences?.transaction?.estimatePrefix || 'EST-';
    else if (type === 'order') prefix = setting?.preferences?.transaction?.saleOrderPrefix || 'SO-';
    else if (type === 'proforma') prefix = setting?.preferences?.transaction?.proformaPrefix || 'PRO-';
    else if (type === 'challan') prefix = setting?.preferences?.transaction?.deliveryChallanPrefix || 'DC-';
    else if (type === 'return' || type === 'credit_note') prefix = setting?.preferences?.transaction?.creditNotePrefix || 'CN-';
    else prefix = setting?.preferences?.transaction?.salePrefix || setting?.invoicePrefix || 'INV-';

    const aggResult = await Sale.aggregate([
      { $match: { ...baseFilter, type } },
      { $sort: { invoiceNumber: -1 } },
      { $limit: 1 },
      { $project: { invoiceNumber: 1 } }
    ]);
    let maxNum = 0;
    if (aggResult.length > 0 && aggResult[0].invoiceNumber) {
      const numStr = aggResult[0].invoiceNumber.startsWith(prefix)
        ? aggResult[0].invoiceNumber.slice(prefix.length)
        : aggResult[0].invoiceNumber;
      const num = parseInt(numStr);
      if (!isNaN(num)) maxNum = num;
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
      validityDays,
      notes, internalNotes, termsConditions,
      additionalField1, additionalField2,
    } = req.body;

    const setting = await Setting.findOne(getSettingQuery(req));

    // Party settings enforcement
    if (customer) {
      const party = await Customer.findOne({ _id: customer, user: req.user._id });
      if (party) {
        if (party.isActive === false) {
          return res.status(400).json({ message: `Cannot create sale for inactive party: ${party.name}. Re-enable the party first.` });
        }
        const managePartyStatus = setting?.preferences?.party?.managePartyStatus !== false;
        if (managePartyStatus && party.isActive === false) {
          return res.status(400).json({ message: `Party "${party.name}" is marked inactive. Update party status to active before creating a sale.` });
        }
        const creditLimit = party.creditLimit || 0;
        if (creditLimit > 0) {
          const outstanding = (party.openingBalance || 0) + (totalAmount || 0);
          if (outstanding > creditLimit) {
            return res.status(400).json({ message: `Credit limit of Rs.${creditLimit.toFixed(2)} exceeded for party "${party.name}". Outstanding: Rs.${outstanding.toFixed(2)}` });
          }
        }
        // Auto-populate shipping address from party if not provided
        if (!shippingAddress && party.shippingAddress) {
          shippingAddress = party.shippingAddress;
        }
        // Auto-populate billing address from party if not provided
        if (!billingAddress && party.address) {
          billingAddress = party.address;
        }
      }
    }

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
    const requireHSN = setting?.preferences?.taxes?.hsnSac === true;
    const productIds = items.filter(item => item.product).map(item => item.product);
    const allProducts = await Product.find({ _id: { $in: productIds }, user: req.user._id });
    const productMap = new Map(allProducts.map(p => [p._id.toString(), p]));

    const serialTrackingEnabled = setting?.preferences?.item?.serialNumberTracking === true;
    const stockTracked = (type || 'invoice') === 'invoice' && (status || 'confirmed') !== 'draft' && stockMaintenance;
    for (const item of items) {
      if (item.product) {
        const prod = productMap.get(item.product.toString());
        if (!prod) return res.status(400).json({ message: `Product not found: ${item.productName}` });
        // Services never affect stock: skip negative-stock & serial validation.
        if (prod.type === 'service') {
          if (requireHSN && !item.hsn && prod?.hsn) item.hsn = prod.hsn;
          continue;
        }
        if (stopOnNegative && prod.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}, Requested: ${item.quantity}` });
        }
        if (requireHSN && !item.hsn && prod?.hsn) {
          item.hsn = prod.hsn;
        }
        // Validate serial numbers BEFORE any mutation so we never partially commit.
        if (stockTracked && serialTrackingEnabled && item.serialNo) {
          if (prod.serialNumbers && prod.serialNumbers.includes(item.serialNo)) {
            return res.status(400).json({ message: `Serial number ${item.serialNo} for ${prod.name} has already been sold` });
          }
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

    // Additional Cess
    const cessEnabled = setting?.preferences?.taxes?.additionalCess === true;
    const cessRate = setting?.preferences?.taxes?.cessRate || 0;
    if (cessEnabled && cessRate > 0) {
      for (const item of items) {
        item.cess = ((item.quantity || 0) * (item.rate || 0)) * cessRate / 100;
      }
    }

    const allowJE = setting?.preferences?.accounting?.allowJournalEntries !== false;

    // Calculate per-item profit
    for (const item of items) {
      if (item.product) {
        const prod = productMap.get(item.product.toString());
        const cp = item.costPrice || prod?.costPrice || 0;
        if (cp > 0 && item.rate > 0) {
          item.costPrice = cp;
          item.profit = (item.rate - cp) * (item.quantity || 0);
          item.profitMargin = item.rate > 0 ? ((item.rate - cp) / item.rate * 100) : 0;
        }
      }
    }

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

    totalAmount = (totalAmount || 0) + tcsAmount - tdsAmount;

    // Collected here, fired AFTER the transaction commits (external side effects).
    const lowStockAlerts = [];

    const sale = new Sale({
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
      additionalField1, additionalField2,
      createdBy: req.user.name || req.user.email,
    });

    await withTransaction(async (session) => {
    await sale.save({ session });

    if (sale.type === 'invoice' && sale.status !== 'draft' && stockMaintenance) {
      const bulkStockOps = [];
      const stockMovements = [];
      const batchUpdates = [];
      const serialNumberUpdates = [];

      for (const item of items) {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (!prod) continue;
          // Services never affect stock: skip deduction, movement, batch & serial updates.
          if (prod.type === 'service') continue;

          const serialTracking = setting?.preferences?.item?.serialNumberTracking === true;

          const balBefore = prod.stock;
          bulkStockOps.push({
            updateOne: {
              filter: { _id: item.product, user: req.user._id },
              update: { $inc: { stock: -item.quantity } }
            }
          });
          stockMovements.push({
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
            batchNo: item.batchNo || undefined,
            serialNo: item.serialNo || undefined,
            date: date || new Date(),
          });
          if (item.batchNo && prod.batches && prod.batches.length > 0) {
            const batch = prod.batches.find(b => b.batchNo === item.batchNo);
            if (batch) {
              batch.stock = Math.max(0, (batch.stock || 0) - item.quantity);
              batchUpdates.push(prod);
            }
          }
          if (serialTracking && item.serialNo) {
            serialNumberUpdates.push({
              updateOne: {
                filter: { _id: item.product, user: req.user._id },
                update: { $addToSet: { serialNumbers: item.serialNo } }
              }
            });
          }
          if ((balBefore - item.quantity) <= (prod.minStock || 0) && prod.minStock > 0) {
            // External side effect: defer until after the transaction commits.
            lowStockAlerts.push({
              productId: prod._id,
              message: `${item.productName || prod.name} is low on stock (${balBefore - item.quantity} remaining, min: ${prod.minStock})`,
            });
          }
        }
      }

      if (bulkStockOps.length > 0) await Product.bulkWrite(bulkStockOps, { session });
      if (stockMovements.length > 0) await StockMovement.insertMany(stockMovements, { session });
      for (const prod of batchUpdates) {
        await prod.save({ session });
      }
      if (serialNumberUpdates.length > 0) await Product.bulkWrite(serialNumberUpdates, { session });
    }

    // Auto-update sale price if setting enabled
    if (setting?.preferences?.item?.updateSalePriceAuto) {
      const priceOps = items
        .filter(item => item.product && item.rate)
        .map(item => ({
          updateOne: {
            filter: { _id: item.product, user: req.user._id },
            update: { $set: { price: item.rate } }
          }
        }));
      if (priceOps.length > 0) await Product.bulkWrite(priceOps, { session });
    }

    // Respect the payment mode: cash goes to the cash ledger/account, everything else
    // (UPI/card/cheque/bank transfer) goes to the bank ledger/account.
    const primaryPayMode = (payments && payments[0] && payments[0].mode) || 'cash';
    const isCashPay = primaryPayMode === 'cash';
    if (paidAmount > 0) {
      const addTime = setting?.preferences?.transaction?.addTimeOnTransactions === true;
      const txnDate = addTime ? new Date() : (date || new Date());
      const txn = new Transaction({
        user: req.user._id,
        business: req.businessId,
        type: isCashPay ? 'cash_in' : 'bank_in',
        amount: paidAmount,
        description: `Payment received - ${invoiceNumber} from ${customerName || 'Walk-in'}`,
        date: txnDate,
        reference: invoiceNumber,
        referenceModel: 'Sale',
        referenceId: sale._id,
        partyName: customerName || 'Walk-in',
        partyType: 'customer',
      });
      await txn.save({ session });
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
        const payCode = isCashPay ? '1001' : '1002';
        let cash = await Account.findOne({ ...baseFilter, code: payCode });
        if (!cash) cash = await Account.findOne({ ...baseFilter, code: '1001' });
        if (cash) {
          debitLine.debit = remainingBalance;
    // Calculate expiry date for estimates/quotations
    if ((sale.type === 'estimate' || sale.type === 'quotation') && validityDays > 0) {
      const expiry = new Date(sale.date || new Date());
      expiry.setDate(expiry.getDate() + validityDays);
      sale.expiryDate = expiry;
      await sale.save({ session });
    } else if ((sale.type === 'estimate' || sale.type === 'quotation') && !validityDays) {
      const defaultDays = setting?.preferences?.transaction?.estimateValidityDays || 15;
      if (defaultDays > 0) {
        const expiry = new Date(sale.date || new Date());
        expiry.setDate(expiry.getDate() + defaultDays);
        sale.expiryDate = expiry;
        sale.validityDays = defaultDays;
        await sale.save({ session });
      }
    }

    if (paidAmount > 0) {
            lines.push({ account: cash._id, accountName: cash.name, accountType: cash.type, debit: paidAmount, credit: 0 });
          }
        }
      }
      const je = new JournalEntry({
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
      await je.save({ session });
      const accountIds = lines.map(l => l.account);
      const accounts = await Account.find({ _id: { $in: accountIds }, user: req.user._id });
      const accountMap = new Map(accounts.map(a => [a._id.toString(), a]));
      const bulkAccountOps = lines.map(line => {
        const acc = accountMap.get(line.account.toString());
        if (!acc) return null;
        const balanceChange = ['asset', 'expense'].includes(acc.type)
          ? line.debit - line.credit
          : line.credit - line.debit;
        return {
          updateOne: {
            filter: { _id: line.account, user: req.user._id },
            update: { $inc: { balance: balanceChange } }
          }
        };
      }).filter(Boolean);
      if (bulkAccountOps.length > 0) await Account.bulkWrite(bulkAccountOps, { session });
    }
    }

    if (customer) {
      await Customer.findOneAndUpdate({ _id: customer, user: req.user._id }, { $inc: { openingBalance: remainingBalance || totalAmount } }, { new: true, session });
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
          const loyaltyEntry = new LoyaltyPoint({
            user: req.user._id,
            business: req.businessId,
            customer, customerName,
            transaction: sale._id, transactionType: 'earn',
            points: pointsEarned, balance: currentBalance + pointsEarned,
            description: `Points earned from sale ${invoiceNumber}`,
            referenceNumber: invoiceNumber,
          });
          await loyaltyEntry.save({ session });
          await Customer.findOneAndUpdate({ _id: customer, user: req.user._id }, { $set: { loyaltyPoints: currentBalance + pointsEarned } }, { new: true, session });
        }
      }
    }
    });

    // ---- External side effects: run only AFTER the transaction commits ----
    for (const alert of lowStockAlerts) {
      createNotification(req.user._id, 'low_stock', 'Low Stock Alert', alert.message, alert.productId, 'Product').catch(() => {});
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

    // Send email/SMS to customer if enabled
    if (customerPhone || customerEmail) {
      const msgText = `Invoice ${invoiceNumber} for Rs.${totalAmount.toFixed(2)}${customerName ? ` - ${customerName}` : ''}`;
      if (customerEmail) {
        sendEmailNotification(req.user._id, {
          to: customerEmail,
          subject: `Invoice ${invoiceNumber} - ${setting?.businessName || 'Your Business'}`,
          html: `<p>Dear ${customerName || 'Customer'},</p><p>${msgText}</p><p>Thank you for your business!</p>`,
        }).catch(() => {});
      }
      if (customerPhone) {
        sendSMSNotification(req.user._id, {
          to: customerPhone,
          message: msgText,
        }).catch(() => {});
      }
    }

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const setting = await Setting.findOne(getSettingQuery(req));
    const passcodeRequired = setting?.preferences?.transaction?.passcodeForEditDelete === true;
    if (passcodeRequired && req.body.passcode) {
      const User = require('../models/User');
      const bcrypt = require('bcryptjs');
      const user = await User.findById(req.user._id);
      if (!user || !(await user.comparePassword(req.body.passcode))) {
        return res.status(403).json({ message: 'Invalid passcode. Edit requires passcode verification.' });
      }
    }

    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const oldPaidAmount = sale.paidAmount;
    const normalizeItems = (arr) => (arr || []).map(i => ({
      product: (i.product || '').toString(),
      quantity: i.quantity || 0,
      rate: i.rate || 0,
      discount: i.discount || 0,
    })).sort((a, b) => a.product.localeCompare(b.product));
    const itemsChanged = req.body.items && JSON.stringify(normalizeItems(req.body.items)) !== JSON.stringify(normalizeItems(sale.items));

    await withTransaction(async (session) => {
    if (itemsChanged && (sale.type === 'invoice' || sale.type === 'challan') && sale.status !== 'draft') {
      // Fetch current stock so the reversal leg can be logged to the movement ledger.
      const oldProductIds = sale.items.filter(item => item.product).map(item => item.product);
      const oldProducts = await Product.find({ _id: { $in: oldProductIds }, user: req.user._id });
      const oldProductMap = new Map(oldProducts.map(p => [p._id.toString(), p]));

      const restoreOps = [];
      const restoreMovements = [];
      for (const item of sale.items) {
        if (item.product) {
          const prod = oldProductMap.get(item.product.toString());
          // Services never affect stock: skip restore (reversal) leg.
          if (prod && prod.type === 'service') continue;
          const balBefore = prod ? prod.stock : 0;
          restoreOps.push({
            updateOne: {
              filter: { _id: item.product, user: req.user._id },
              update: { $inc: { stock: item.quantity } }
            }
          });
          // Log the restore (reversal) leg so Product.stock reconciles with the ledger.
          restoreMovements.push({
            user: req.user._id,
            business: req.businessId,
            product: item.product, productName: item.productName,
            type: 'sale_adjustment', quantity: item.quantity,
            balanceBefore: balBefore, balanceAfter: balBefore + item.quantity,
            rate: item.rate, totalAmount: item.amount,
            referenceType: 'Sale', referenceId: sale._id,
            referenceNumber: sale.invoiceNumber,
            description: `Stock reversal on sale update - ${sale.invoiceNumber}`,
            date: new Date(),
          });
        }
      }
      if (restoreOps.length > 0) await Product.bulkWrite(restoreOps, { session });
      if (restoreMovements.length > 0) await StockMovement.insertMany(restoreMovements, { session });
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
      'eWayBill', 'transportMode', 'vehicleNo', 'poNumber', 'validityDays', 'expiryDate', 'isExpired',
      'notes', 'internalNotes', 'termsConditions', 'deliveryStatus',
      'additionalField1', 'additionalField2'];

    fields.forEach(f => {
      if (req.body[f] !== undefined) sale[f] = req.body[f];
    });
    sale.updatedBy = req.user.name || req.user.email;

    if (itemsChanged && (sale.type === 'invoice' || sale.type === 'challan') && sale.status !== 'draft') {
      const newProductIds = sale.items.filter(item => item.product).map(item => item.product);
      const newProducts = await Product.find({ _id: { $in: newProductIds }, user: req.user._id });
      const newProductMap = new Map(newProducts.map(p => [p._id.toString(), p]));

      const adjustOps = [];
      const adjustMovements = [];
      for (const item of sale.items) {
        if (item.product) {
          const prod = newProductMap.get(item.product.toString());
          // Services never affect stock: skip apply (deduction) leg.
          if (prod && prod.type === 'service') continue;
          const balBefore = prod ? prod.stock : 0;
          adjustOps.push({
            updateOne: {
              filter: { _id: item.product, user: req.user._id },
              update: { $inc: { stock: -item.quantity } }
            }
          });
          adjustMovements.push({
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
      if (adjustOps.length > 0) await Product.bulkWrite(adjustOps, { session });
      if (adjustMovements.length > 0) await StockMovement.insertMany(adjustMovements, { session });
    }

    // Apply the FULL signed delta in paid amount (both increases AND decreases).
    // Previously only positive deltas were posted, so reducing the paid amount on
    // edit left Customer.openingBalance overstated and created no reversing record.
    const paidDelta = sale.paidAmount - oldPaidAmount;
    if (paidDelta !== 0) {
      const deltaTxn = new Transaction({
        user: req.user._id,
        business: req.businessId,
        // Increase in paid = cash_in; decrease (refund/correction) = cash_out
        type: paidDelta > 0 ? 'cash_in' : 'cash_out',
        amount: Math.abs(paidDelta),
        description: `${paidDelta > 0 ? 'Payment received' : 'Payment adjusted/reversed'} - ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
        date: new Date(),
        reference: sale.invoiceNumber,
        referenceModel: 'Sale',
        referenceId: sale._id,
        partyName: sale.customerName || 'Walk-in',
        partyType: 'customer',
      });
      await deltaTxn.save({ session });
      if (sale.customer) {
        // openingBalance tracks receivable: more paid -> lower balance, less paid -> higher.
        await Customer.findOneAndUpdate({ _id: sale.customer, user: req.user._id }, { $inc: { openingBalance: -paidDelta } }, { session });
      }
    }

    await sale.save({ session });
    });
    createNotification(req.user._id, 'sale_updated', 'Sale Updated',
      `Invoice ${sale.invoiceNumber} has been updated`,
      sale._id, 'Sale'
    ).catch(() => {});
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const setting = await Setting.findOne(getSettingQuery(req));
    const passcodeRequired = setting?.preferences?.transaction?.passcodeForEditDelete === true;
    if (passcodeRequired && req.body.passcode) {
      const User = require('../models/User');
      const bcrypt = require('bcryptjs');
      const user = await User.findById(req.user._id);
      if (!user || !(await user.comparePassword(req.body.passcode))) {
        return res.status(403).json({ message: 'Invalid passcode. Delete requires passcode verification.' });
      }
    }

    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    await withTransaction(async (session) => {
    const deleteProductIds = sale.items.filter(item => item.product).map(item => item.product);
    const deleteProducts = await Product.find({ _id: { $in: deleteProductIds }, user: req.user._id });
    const deleteProductMap = new Map(deleteProducts.map(p => [p._id.toString(), p]));
    const deleteStockOps = [];
    const deleteMovements = [];
    for (const item of sale.items) {
      if (item.product) {
        const prod = deleteProductMap.get(item.product.toString());
        // Services never affect stock: skip restore on delete.
        if (prod && prod.type === 'service') continue;
        const balBefore = prod ? prod.stock : 0;
        deleteStockOps.push({
          updateOne: {
            filter: { _id: item.product, user: req.user._id },
            update: { $inc: { stock: item.quantity } }
          }
        });
        deleteMovements.push({
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
    if (deleteStockOps.length > 0) await Product.bulkWrite(deleteStockOps, { session });
    if (deleteMovements.length > 0) await StockMovement.insertMany(deleteMovements, { session });

    if (sale.customer) {
      await Customer.findOneAndUpdate({ _id: sale.customer, user: req.user._id }, { $inc: { openingBalance: -sale.remainingBalance } }, { new: true, session });
    }

    // Reverse journal entry if one was created
    const journalEntry = await JournalEntry.findOne({ referenceType: 'sale', referenceId: sale._id, user: req.user._id });
    if (journalEntry) {
      const reverseAccountIds = journalEntry.lines.filter(l => l.account).map(l => l.account);
      const reverseAccounts = await Account.find({ _id: { $in: reverseAccountIds }, user: req.user._id });
      const reverseAccountMap = new Map(reverseAccounts.map(a => [a._id.toString(), a]));
      const reverseOps = journalEntry.lines.filter(l => l.account).map(line => {
        const acc = reverseAccountMap.get(line.account.toString());
        if (!acc) return null;
        return {
          updateOne: {
            filter: { _id: line.account, user: req.user._id },
            update: { $inc: { balance: line.debit ? -line.debit : line.credit } }
          }
        };
      }).filter(Boolean);
      if (reverseOps.length > 0) await Account.bulkWrite(reverseOps, { session });
      await JournalEntry.findOneAndDelete({ _id: journalEntry._id, user: req.user._id }, { session });
    }

    sale.status = 'cancelled';
    await sale.save({ session });
    });
    createNotification(req.user._id, 'sale_cancelled', 'Sale Cancelled',
      `Invoice ${sale.invoiceNumber} has been cancelled`,
      sale._id, 'Sale'
    ).catch(() => {});
    sendAutoMessage(req.user._id, req.businessId, 'cancelled', {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      invoiceNumber: sale.invoiceNumber,
      invoiceId: sale._id,
      totalAmount: sale.totalAmount,
    }).catch(() => {});
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
    // Guard: prevent returning the same source twice (would double-restore stock & balance).
    if (original.isConverted) {
      return res.status(400).json({ message: `This ${original.type} has already been converted${original.convertedTo ? ` (${original.convertedTo})` : ''}.` });
    }

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

    returnData.business = req.businessId;
    const creditNote = new Sale(returnData);

    await withTransaction(async (session) => {
    const returnProductIds = returnData.items.filter(item => item.product).map(item => item.product);
    const returnProducts = await Product.find({ _id: { $in: returnProductIds }, user: req.user._id });
    const returnProductMap = new Map(returnProducts.map(p => [p._id.toString(), p]));
    const returnStockOps = [];
    const returnMovements = [];
    for (const item of returnData.items) {
      if (item.product) {
        const prod = returnProductMap.get(item.product.toString());
        // Services never affect stock: skip return restore.
        if (prod && prod.type === 'service') continue;
        const balBefore = prod ? prod.stock : 0;
        returnStockOps.push({
          updateOne: {
            filter: { _id: item.product, user: req.user._id },
            update: { $inc: { stock: item.quantity } }
          }
        });
        returnMovements.push({
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
          referenceId: creditNote._id,
          referenceNumber: creditNoteNumber,
          description: `Credit note ${creditNoteNumber} for ${original.invoiceNumber}`,
          date: new Date(),
        });
      }
    }
    if (returnStockOps.length > 0) await Product.bulkWrite(returnStockOps, { session });
    if (returnMovements.length > 0) await StockMovement.insertMany(returnMovements, { session });

    await creditNote.save({ session });

    // Mark the SOURCE as converted so it can't be returned/converted twice.
    // isConverted/convertedTo are not in the Sale schema; { strict: false } persists them.
    await Sale.updateOne(
      { _id: original._id, user: req.user._id },
      { $set: { isConverted: true, convertedTo: creditNoteNumber } },
      { strict: false, session }
    );

    const cnTxn = new Transaction({
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
    await cnTxn.save({ session });

    if (creditNote.customer) {
      await Customer.findOneAndUpdate({ _id: creditNote.customer, user: req.user._id }, { $inc: { openingBalance: -original.totalAmount } }, { session });
    }

    // Create journal entry for credit note
    const cnBaseFilter = getBaseFilter(req);
    const custAcc = await Account.findOne({ ...cnBaseFilter, code: '1101' });
    const salesAcc = await Account.findOne({ ...cnBaseFilter, code: '4001' });
    if (custAcc && salesAcc) {
      const cnLines = [
        { account: salesAcc._id, accountName: salesAcc.name, accountType: salesAcc.type, debit: original.totalAmount, credit: 0 },
        { account: custAcc._id, accountName: custAcc.name, accountType: custAcc.type, debit: 0, credit: original.totalAmount },
      ];
      const cnJe = new JournalEntry(
        getCreateData(req, {
          entryNumber: `JE-CN-${creditNoteNumber}`,
          entryDate: new Date(),
          referenceType: 'Sale',
          referenceId: creditNote._id,
          lines: cnLines,
          totalDebit: original.totalAmount,
          totalCredit: original.totalAmount,
          narration: `Credit note ${creditNoteNumber} against ${original.invoiceNumber}`,
          isPosted: true,
          postedAt: new Date(),
        })
      );
      await cnJe.save({ session });
      const cnAccIds = cnLines.map(l => l.account);
      const cnAccounts = await Account.find({ _id: { $in: cnAccIds }, user: req.user._id });
      const cnAccMap = new Map(cnAccounts.map(a => [a._id.toString(), a]));
      const cnBalanceOps = cnLines.map(line => {
        const acc = cnAccMap.get(line.account.toString());
        if (!acc) return null;
        const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
        return { updateOne: { filter: { _id: line.account, user: req.user._id }, update: { $inc: { balance: change } } } };
      }).filter(Boolean);
      if (cnBalanceOps.length > 0) await Account.bulkWrite(cnBalanceOps, { session });
    }
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
    // Guard: prevent converting the same source twice (would double-count stock & balance).
    if (original.isConverted) {
      return res.status(400).json({ message: `This ${original.type} has already been converted${original.convertedTo ? ` to invoice ${original.convertedTo}` : ''}.` });
    }

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

    const convProductIds = invoiceData.items.filter(item => item.product).map(item => item.product);
    const convProducts = await Product.find({ _id: { $in: convProductIds }, user: req.user._id });
    const convProductMap = new Map(convProducts.map(p => [p._id.toString(), p]));

    for (const item of invoiceData.items) {
      if (item.product) {
        const prod = convProductMap.get(item.product.toString());
        if (!prod) return res.status(400).json({ message: `Product not found: ${item.productName}` });
        // Services never affect stock: skip negative-stock validation.
        if (prod.type === 'service') continue;
        if (stopOnNegative && prod.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}, Requested: ${item.quantity}` });
        }
      }
    }

    invoiceData.business = req.businessId;
    const invoice = new Sale(invoiceData);

    const convStockOps = [];
    const convMovements = [];
    for (const item of invoiceData.items) {
      if (item.product) {
        const prod = convProductMap.get(item.product.toString());
        // Services never affect stock: skip deduction & movement.
        if (prod && prod.type === 'service') continue;
        const balBefore = prod ? prod.stock : 0;
        convStockOps.push({
          updateOne: {
            filter: { _id: item.product, user: req.user._id },
            update: { $inc: { stock: -item.quantity } }
          }
        });
        convMovements.push({
          user: req.user._id,
          business: req.businessId,
          product: item.product, productName: item.productName,
          type: 'sale', quantity: -item.quantity, balanceBefore: balBefore,
          balanceAfter: balBefore - item.quantity, rate: item.rate, totalAmount: item.amount,
          referenceType: 'Sale', referenceId: invoice._id, referenceNumber: invoiceNumber,
          description: `Invoice ${invoiceNumber} (converted from ${original.type} ${original.invoiceNumber})`,
          date: new Date(),
        });
      }
    }

    await withTransaction(async (session) => {
    if (convStockOps.length > 0) await Product.bulkWrite(convStockOps, { session });
    if (convMovements.length > 0) await StockMovement.insertMany(convMovements, { session });

    await invoice.save({ session });

    // Mark the SOURCE document as converted so it cannot be converted/invoiced again
    // (which would double-count stock & customer balance). isConverted/convertedTo are
    // not in the Sale schema, so { strict: false } is required to persist them.
    await Sale.updateOne(
      { _id: original._id, user: req.user._id },
      { $set: { isConverted: true, convertedTo: invoiceNumber } },
      { strict: false, session }
    );

    if (invoiceData.customer) {
      await Customer.findOneAndUpdate({ _id: invoiceData.customer, user: req.user._id }, { $inc: { openingBalance: invoiceData.remainingBalance || invoiceData.totalAmount } }, { new: true, session });
    }

    // Create journal entry for converted invoice
    const invBaseFilter = getBaseFilter(req);
    const custAccount = await Account.findOne({ ...invBaseFilter, code: '1101' });
    const salesAccount = await Account.findOne({ ...invBaseFilter, code: '4001' });
    if (custAccount && salesAccount) {
      const invLines = [
        { account: custAccount._id, accountName: custAccount.name, accountType: custAccount.type, debit: original.totalAmount, credit: 0 },
        { account: salesAccount._id, accountName: salesAccount.name, accountType: salesAccount.type, debit: 0, credit: original.totalAmount },
      ];
      const invJe = new JournalEntry(
        getCreateData(req, {
          entryNumber: `JE-INV-${invoiceNumber}`,
          entryDate: new Date(),
          referenceType: 'sale',
          referenceId: invoice._id,
          lines: invLines,
          totalDebit: original.totalAmount,
          totalCredit: original.totalAmount,
          narration: `Invoice ${invoiceNumber} converted from ${original.type} ${original.invoiceNumber}`,
          isPosted: true,
          postedAt: new Date(),
        })
      );
      await invJe.save({ session });
      const invAccIds = invLines.map(l => l.account);
      const invAccounts = await Account.find({ _id: { $in: invAccIds }, user: req.user._id });
      const invAccMap = new Map(invAccounts.map(a => [a._id.toString(), a]));
      const invBalanceOps = invLines.map(line => {
        const acc = invAccMap.get(line.account.toString());
        if (!acc) return null;
        const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
        return { updateOne: { filter: { _id: line.account, user: req.user._id }, update: { $inc: { balance: change } } } };
      }).filter(Boolean);
      if (invBalanceOps.length > 0) await Account.bulkWrite(invBalanceOps, { session });
    }
    });

    sendAutoMessage(req.user._id, req.businessId, 'invoice', {
      customerName: original.customerName || 'Walk-in',
      customerPhone: original.customerPhone || '',
      invoiceNumber,
      invoiceId: invoice._id,
      date: new Date(),
      totalAmount: original.totalAmount,
      remainingBalance: original.remainingBalance,
    }).catch(() => {});

    createNotification(req.user._id, 'new_sale', 'Invoice Created',
      `Invoice ${invoiceNumber} converted from ${original.type} for Rs.${(original.totalAmount || 0).toFixed(2)}`,
      invoice._id, 'Sale'
    ).catch(() => {});

    if (original.customerPhone || original.customerEmail) {
      const msgText = `Invoice ${invoiceNumber} for Rs.${(original.totalAmount || 0).toFixed(2)}${original.customerName ? ` - ${original.customerName}` : ''}`;
      if (original.customerEmail) {
        const { sendEmailNotification } = require('../services/emailService');
        sendEmailNotification(req.user._id, {
          to: original.customerEmail,
          subject: `Invoice ${invoiceNumber} - Converted from ${original.type}`,
          html: `<p>Dear ${original.customerName || 'Customer'},</p><p>${msgText}</p>`,
        }).catch(() => {});
      }
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

    const { amount, mode, transactionNo, bankName, chequeNo, referenceNo, date, notes, discount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid payment amount' });
    if (amount > sale.remainingBalance) return res.status(400).json({ message: `Amount exceeds remaining balance of ${sale.remainingBalance}` });

    const setting = await Setting.findOne(getSettingQuery(req));
    const linkPaymentsToInvoice = setting?.preferences?.transaction?.linkPaymentsToInvoice === true;

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

    const receipt = new Receipt({
      user: req.user._id,
      business: req.businessId,
      receiptNumber, sale: sale._id, invoiceNumber: sale.invoiceNumber,
      customer: sale.customer, customerName: sale.customerName || 'Walk-in',
      date: date || new Date(), amount: Number(amount), mode: mode || 'cash',
      discount: Number(discount) || 0,
      transactionNo, bankName, chequeNo, referenceNo, notes,
      createdBy: req.user.name || req.user.email,
    });

    await withTransaction(async (session) => {
    await sale.save({ session });

    if (sale.customer) {
      await Customer.findOneAndUpdate({ _id: sale.customer, user: req.user._id }, { $inc: { openingBalance: -Number(amount) } }, { session });
    }

    await receipt.save({ session });

    const isCashPay = (mode || 'cash') === 'cash';
    const payTxn = new Transaction({
      user: req.user._id,
      business: req.businessId,
      type: isCashPay ? 'cash_in' : 'bank_in', amount: Number(amount),
      description: `Payment received - ${receiptNumber} for ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
      date: date || new Date(), reference: receiptNumber, referenceModel: 'Receipt', referenceId: receipt._id,
      partyName: sale.customerName || 'Walk-in', partyType: 'customer',
    });
    await payTxn.save({ session });

    // Create journal entry for payment received
    let payAccount = await Account.findOne({ ...baseFilter, code: isCashPay ? '1001' : '1002' });
    if (!payAccount) payAccount = await Account.findOne({ ...baseFilter, code: '1001' });
    const custAccount = await Account.findOne({ ...baseFilter, code: '1101' });
    if (payAccount && custAccount) {
      const payLines = [
        { account: payAccount._id, accountName: payAccount.name, accountType: payAccount.type, debit: Number(amount), credit: 0 },
        { account: custAccount._id, accountName: custAccount.name, accountType: custAccount.type, debit: 0, credit: Number(amount) },
      ];
      const payJe = new JournalEntry(
        getCreateData(req, {
          entryNumber: `JE-RCV-${receiptNumber}`,
          entryDate: date || new Date(),
          referenceType: 'receipt',
          referenceId: receipt._id,
          lines: payLines,
          totalDebit: Number(amount),
          totalCredit: Number(amount),
          narration: `Payment received for ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
          isPosted: true,
          postedAt: new Date(),
        })
      );
      await payJe.save({ session });
      const payAccIds = payLines.map(l => l.account);
      const payAccounts = await Account.find({ _id: { $in: payAccIds }, user: req.user._id });
      const payAccMap = new Map(payAccounts.map(a => [a._id.toString(), a]));
      const payBalanceOps = payLines.map(line => {
        const acc = payAccMap.get(line.account.toString());
        if (!acc) return null;
        const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
        return { updateOne: { filter: { _id: line.account, user: req.user._id }, update: { $inc: { balance: change } } } };
      }).filter(Boolean);
      if (payBalanceOps.length > 0) await Account.bulkWrite(payBalanceOps, { session });
    }
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

      // Send payment received email/SMS to customer
      if (sale.customerEmail || sale.customerPhone) {
        const payMsg = `Payment of Rs.${Number(amount).toFixed(2)} received for Invoice ${sale.invoiceNumber}. Balance: Rs.${sale.remainingBalance.toFixed(2)}`;
        if (sale.customerEmail) {
          sendEmailNotification(req.user._id, {
            to: sale.customerEmail,
            subject: `Payment Received - Invoice ${sale.invoiceNumber}`,
            html: `<p>Dear ${sale.customerName || 'Customer'},</p><p>We have received your payment of Rs.${Number(amount).toFixed(2)}.</p><p>Invoice: ${sale.invoiceNumber}</p><p>Balance: Rs.${sale.remainingBalance.toFixed(2)}</p><p>Thank you!</p>`,
          }).catch(() => {});
        }
        if (sale.customerPhone) {
          sendSMSNotification(req.user._id, {
            to: sale.customerPhone,
            message: payMsg,
          }).catch(() => {});
        }
      }
    }

    res.status(201).json({ sale, receipt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateEWayBill = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (sale.eWayBillData && sale.eWayBillData.ewbNo) {
      return res.status(400).json({ message: 'E-Way Bill already generated for this invoice', eWayBill: sale.eWayBill });
    }

    if (sale.totalAmount < 50000) {
      return res.status(400).json({ message: 'E-Way Bill is not required for invoices below Rs.50,000' });
    }

    const setting = await Setting.findOne(getSettingQuery(req));
    const gstNumber = setting?.preferences?.taxes?.gstin || '';
    if (!gstNumber) {
      return res.status(400).json({ message: 'GSTIN is required for E-Way Bill generation. Please update your business settings.' });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (await Sale.countDocuments({
      ...getBaseFilter(req),
      'eWayBillData.prepRef': { $regex: `^EWB${dateStr}` }
    })) + 1;
    const prepRef = `EWB${dateStr}${seq.toString().padStart(6, '0')}`;

    const formatDateDDMMYYYY = (d) => {
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const sellerStateCode = extractStateCode(gstNumber);

    const customerStateCode = sale.customerState
      ? extractStateCodeFromName(sale.customerState)
      : sellerStateCode;

    const isInterState = sellerStateCode !== customerStateCode;

    const items = (sale.items || []).map((item) => ({
      hsnCode: item.hsn || '',
      productDescription: item.productName || '',
      quantity: item.quantity || 0,
      uom: item.unit || 'NOS',
      taxableAmount: item.taxableAmount || item.amount || 0,
      gstRate: item.gstRate || 0,
      cgstAmount: item.cgst || 0,
      sgstAmount: item.sgst || 0,
      igstAmount: item.igst || 0,
      cessAmount: item.cess || 0,
    }));

    const totalTaxableValue = sale.taxableAmount || sale.totalAmount || 0;

    const eWayBillJson = {
      supplyType: 'O',
      subSupplyType: '0',
      docType: 'INV',
      docNo: sale.invoiceNumber || '',
      docDate: formatDateDDMMYYYY(sale.date || now),
      fromGstin: gstNumber,
      fromTrdName: setting.businessName || '',
      fromState: sellerStateCode,
      fromAddr1: setting.address || '',
      fromAddr2: '',
      fromPlace: '',
      fromPincode: setting.pincode || '',
      fromStateCode: sellerStateCode,
      toGstin: sale.customerGst || '',
      toTrdName: sale.customerName || '',
      toState: customerStateCode,
      toAddr1: sale.billingAddress || sale.shippingAddress || '',
      toAddr2: '',
      toPlace: '',
      toPincode: '',
      toStateCode: customerStateCode,
      totalValue: sale.totalAmount || 0,
      cgstValue: sale.cgstTotal || 0,
      sgstValue: sale.sgstTotal || 0,
      igstValue: sale.igstTotal || 0,
      cessValue: sale.cessTotal || 0,
      totalInvoiceValue: sale.totalAmount || 0,
      transporterId: '',
      transporterName: '',
      transportMode: sale.transportMode || 'Road',
      vehicleNo: sale.vehicleNo || '',
      distance: 0,
      transactionType: isInterState ? '2' : '1',
      otherValue: sale.additionalChargesTotal || 0,
      cessNonAdvolValue: 0,
      reverseCharge: sale.reverseCharge ? 'Y' : 'N',
      docCategory: 'Invoice',
      items,
      itemList: items,
    };

    sale.eWayBill = prepRef;
    sale.eWayBillData = {
      prepRef,
      generatedAt: now.toISOString(),
      status: 'prepared',
      ewbJson: eWayBillJson,
    };
    await sale.save();

    res.json({
      message: 'E-Way Bill data prepared successfully. Ready for upload to ewaybillgst.gov.in',
      prepRef,
      eWayBill: prepRef,
      eWayBillData: eWayBillJson,
      status: 'prepared',
      invoiceNumber: sale.invoiceNumber,
      totalAmount: sale.totalAmount,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateDelivery = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sale = await Sale.findOne({ _id: req.params.id, ...baseFilter });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const { deliveredQuantity, trackingNumber, deliveryNotes, deliveryDate } = req.body;
    
    if (deliveredQuantity !== undefined) {
      sale.deliveredQuantity = (sale.deliveredQuantity || 0) + Number(deliveredQuantity);
      sale.partialDeliveries = sale.partialDeliveries || [];
      sale.partialDeliveries.push({
        date: deliveryDate || new Date(),
        quantity: Number(deliveredQuantity),
        trackingNumber: trackingNumber || '',
        notes: deliveryNotes || '',
        deliveredBy: req.user.name || req.user.email,
      });
    }
    
    if (trackingNumber) sale.trackingNumber = trackingNumber;
    if (deliveryNotes) sale.deliveryNotes = deliveryNotes;
    if (deliveryDate) sale.deliveryDate = deliveryDate;

    const totalOrdered = sale.items.reduce((s, i) => s + (i.quantity || 0), 0);
    if (sale.deliveredQuantity >= totalOrdered) {
      sale.deliveryStatus = 'delivered';
    } else if (sale.deliveredQuantity > 0) {
      sale.deliveryStatus = 'partial';
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateEInvoice = async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, ...getBaseFilter(req) }).populate('customer', 'name gstNumber state');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.totalAmount < 500000) {
      return res.status(400).json({ message: 'E-Invoice is mandatory only for B2B invoices above Rs.5,00,000' });
    }

    const setting = await Setting.findOne(getSettingQuery(req));
    const gstin = setting?.gstNumber || setting?.preferences?.taxes?.gstin || '';
    if (!gstin) {
      return res.status(400).json({ message: 'GSTIN is required for E-Invoice generation' });
    }

    const eInvoice = {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: sale.isInterState ? 'SEZ' : 'B2B',
        RegRev: sale.reverseCharge ? 'Y' : 'N',
        IgstOnIntra: sale.isInterState ? 'N' : 'N',
      },
      DocDtls: {
        Typ: 'INV',
        No: sale.invoiceNumber,
        Dt: new Date(sale.date).toISOString().split('T')[0].split('-').reverse().join('/'),
      },
      SellerDtls: {
        Gstin: gstin,
        TrdNm: setting.businessName || 'Business',
        Addr1: setting.address || '',
        Loc: setting.state || '',
        State: setting.state || '',
        Pin: parseInt(setting.pincode || '0'),
        Ph: setting.phone || '',
        Email: setting.email || '',
      },
      BuyerDtls: {
        Gstin: sale.customer?.gstNumber || sale.customerGst || 'URP',
        TrdNm: sale.customer?.name || sale.customerName || '',
        Addr1: sale.billingAddress || '',
        Loc: sale.customerState || '',
        State: sale.customerState || '',
        Pin: 0,
        Ph: sale.customerPhone || '',
        Email: sale.customerEmail || '',
      },
      ItemList: (sale.items || []).map((item, idx) => ({
        SlNo: String(idx + 1),
        PrdDesc: item.productName || '',
        IsServc: item.isService ? 'Y' : 'N',
        HsnCd: item.hsn || '',
        Qty: item.quantity || 0,
        Unit: item.unit || 'NOS',
        UnitPrice: item.rate || 0,
        TotAmt: item.amount || 0,
        Discount: item.discountAmount || 0,
        PreTaxVal: item.taxableAmount || 0,
        AssAmt: item.taxableAmount || (item.amount || 0),
        GstRt: item.gstRate || 0,
        SgstAmt: item.cgst || 0,
        CgstAmt: item.sgst || 0,
        IgstAmt: item.igst || 0,
        CesRt: 0,
        CesAmt: item.cess || 0,
        TotItemVal: item.amount || 0,
      })),
      ValDtls: {
        AssVal: sale.taxableAmount || 0,
        CgstVal: sale.cgstTotal || 0,
        SgstVal: sale.sgstTotal || 0,
        IgstVal: sale.igstTotal || 0,
        CesVal: sale.cessTotal || 0,
        StCesVal: 0,
        RndOffAmt: sale.roundOff || 0,
        InvVal: sale.totalAmount || 0,
      },
      PayDtls: {
        Nm: sale.customer?.name || sale.customerName || '',
        Mode: sale.payments?.[0]?.mode || 'Credit',
        FinAdvRcy: '',
        PaymntDue: sale.dueDate ? Math.max(0, Math.ceil((new Date(sale.dueDate) - new Date()) / (1000*60*60*24))) : 0,
      },
      RefDtls: {
        InvRmk: sale.notes || '',
        InvStDt: new Date(sale.date).toISOString().split('T')[0].split('-').reverse().join('/'),
        InvEndDt: sale.dueDate ? new Date(sale.dueDate).toISOString().split('T')[0].split('-').reverse().join('/') : '',
      },
      AddlDocDtls: [],
      ExpDtls: sale.isInterState ? {} : undefined,
      EwbDtls: sale.eWayBill ? {
        TransId: '',
        TransName: '',
        TransMode: sale.transportMode || 'Road',
        TransDocNo: '',
        TransDocDt: '',
        VehNo: sale.vehicleNo || '',
        VehType: 'R',
        Distance: 0,
      } : undefined,
    };

    if (!eInvoice.ExpDtls) delete eInvoice.ExpDtls;
    if (!eInvoice.EwbDtls) delete eInvoice.EwbDtls;

    const crypto = require('crypto');
    const irnHash = crypto.createHash('sha256')
      .update(`${sale.invoiceNumber}${gstin}${new Date(sale.date).toISOString()}`)
      .digest('hex').toUpperCase().substring(0, 64);

    sale.irn = irnHash;
    sale.eInvoiceData = eInvoice;
    sale.eInvoiceAckNo = `ACK${Date.now()}`;
    sale.eInvoiceAckDate = new Date();
    await sale.save();

    res.json({
      message: 'E-Invoice data prepared successfully',
      irn: irnHash,
      ackNo: sale.eInvoiceAckNo,
      ackDate: sale.eInvoiceAckDate,
      invoiceNumber: sale.invoiceNumber,
      totalAmount: sale.totalAmount,
      eInvoice,
      note: 'This is prepared data. Upload to the GSTN e-invoice portal for actual IRN generation.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSales, getSaleById, createSale, updateSale, deleteSale,
  getNextInvoiceNumber, duplicateSale, convertToReturn, convertToChallan, convertToEstimate,
  getSalesByCustomer, convertToInvoice, receivePayment, generateEWayBill, updateDelivery,
  generateEInvoice,
};
