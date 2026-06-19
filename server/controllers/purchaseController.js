const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const { withTransaction } = require('../utils/withTransaction');
const { recordStockMovement } = require('./stockController');
const { getBaseFilter, getCreateData, getSettingQuery } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');
const { sendAutoMessage } = require('../services/messageService');
const { sendPushNotification } = require('../services/pushNotificationService');

const getPurchases = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { billNumber: { $regex: escaped, $options: 'i' } },
        { supplierName: { $regex: escaped, $options: 'i' } },
        { 'items.productName': { $regex: escaped, $options: 'i' } },
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
      paidAmount, paymentStatus, paymentMethod, notes, isInterState,
    } = req.body;
    // totalAmount is reassigned later (TCS/TDS, rounding), so it must be mutable.
    let totalAmount = req.body.totalAmount;

    const setting = await Setting.findOne(getSettingQuery(req));
    const calcTaxOnMRP = setting?.preferences?.item?.calculateTaxOnMRP === true;
    const stockMaintenance = setting?.preferences?.item?.stockMaintenance !== false;
    const cessEnabled = setting?.preferences?.taxes?.additionalCess === true;
    const cessRate = setting?.preferences?.taxes?.cessRate || 0;
    const enableGST = setting?.preferences?.taxes?.enableGST !== false;
    const enableTCS = setting?.preferences?.taxes?.enableTCS === true;
    const tcsRate = setting?.preferences?.taxes?.tcsRate || 0;
    const enableTDS = setting?.preferences?.taxes?.enableTDS === true;
    const tdsRate = setting?.preferences?.taxes?.tdsRate || 0;
    const compositionScheme = setting?.preferences?.taxes?.compositionScheme === true;
    const inclusiveTax = setting?.preferences?.transaction?.inclusiveExclusiveTax === 'inclusive';
    const roundOffEnabled = setting?.preferences?.transaction?.roundOffTotal === true;
    const roundingMethod = setting?.preferences?.transaction?.roundingMethod || 'nearest';

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item required' });
    }

    // Calculate tax totals
    let taxableAmount = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const processedItems = items.map((item) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const grossAmount = qty * rate;
      let taxable;
      if (inclusiveTax && enableGST && (item.gstRate || 0) > 0) {
        taxable = grossAmount / (1 + (item.gstRate || 0) / 100);
      } else {
        taxable = grossAmount;
      }
      const baseForTax = (calcTaxOnMRP && item.mrp) ? item.mrp * qty : taxable;
      const gstHalf = enableGST && !isInterState ? baseForTax * ((item.gstRate || 0) / 100) / 2 : 0;
      const igstAmt = enableGST && isInterState ? baseForTax * ((item.gstRate || 0) / 100) : 0;
      taxableAmount += taxable;
      cgstTotal += gstHalf;
      sgstTotal += gstHalf;
      igstTotal += igstAmt;
      return {
        product: item.product || undefined,
        productName: item.productName || '',
        quantity: qty,
        rate,
        amount: taxable + gstHalf + gstHalf + igstAmt,
        gstRate: item.gstRate || 0,
        taxableAmount: taxable,
        cgst: gstHalf,
        sgst: gstHalf,
        igst: igstAmt,
        batchNo: item.batchNo || undefined,
        serialNo: item.serialNo || undefined,
        hsn: item.hsn || undefined,
      };
    });

    const requireHSN = setting?.preferences?.taxes?.hsnSac === true;

    if (requireHSN) {
      const hsnProductIds = processedItems.filter(item => item.product).map(item => item.product);
      const hsnProducts = await Product.find({ _id: { $in: hsnProductIds }, ...baseFilter });
      const hsnProductMap = new Map(hsnProducts.map(p => [p._id.toString(), p]));
      for (const item of processedItems) {
        const prod = item.product ? hsnProductMap.get(item.product.toString()) : undefined;
        if (!item.hsn && prod?.hsn) {
          item.hsn = prod.hsn;
        }
      }
    }

    if (compositionScheme) {
      for (const item of processedItems) {
        item.gstRate = 0;
        item.cgst = 0;
        item.sgst = 0;
        item.igst = 0;
      }
    }
    if (cessEnabled && cessRate > 0) {
      for (const item of processedItems) {
        item.cess = item.amount * cessRate / 100;
      }
    }

    // Auto-create supplier if needed
    let supplierId = supplier;
    if (supplierName && !supplier) {
      let existing = await Supplier.findOne({ ...baseFilter, name: supplierName });
      if (!existing) {
        existing = await Supplier.create({ user: req.user._id, business: req.businessId, name: supplierName });
      }
      supplierId = existing._id;
    }

    let tcsAmount = 0;
    let tdsAmount = 0;
    if (enableTCS) {
      tcsAmount = (taxableAmount || totalAmount || 0) * tcsRate / 100;
    }
    if (enableTDS) {
      tdsAmount = (taxableAmount || totalAmount || 0) * tdsRate / 100;
    }

    totalAmount = (totalAmount || 0) + tcsAmount - tdsAmount;

    if (roundOffEnabled && totalAmount) {
      let roundOff;
      if (roundingMethod === 'nearest') {
        roundOff = Math.round(totalAmount) - totalAmount;
      } else if (roundingMethod === 'up') {
        roundOff = Math.ceil(totalAmount) - totalAmount;
      } else if (roundingMethod === 'down') {
        roundOff = Math.floor(totalAmount) - totalAmount;
      }
      if (roundOff !== 0) totalAmount = Math.round(totalAmount);
    }

    // Movements to record AFTER the transaction commits. recordStockMovement
    // lives in stockController and does not accept a session, so it cannot
    // participate in this transaction; we collect the movement payloads here
    // and replay them once the atomic writes have committed.
    let purchaseMovements = [];

    const purchase = await withTransaction(async (session) => {
      // Reset on each (possibly retried) attempt so the post-commit replay is not duplicated.
      purchaseMovements = [];
      const purchase = new Purchase({
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
        tcsAmount,
        tdsAmount,
        totalAmount,
        paidAmount: paidAmount || 0,
        remainingBalance: totalAmount - (paidAmount || 0),
        paymentStatus: paymentStatus || (paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'),
        paymentMethod: paymentMethod || 'cash',
        paymentDate: paidAmount > 0 ? (date || new Date()) : undefined,
        notes,
        isInterState: isInterState || false,
      });
      await purchase.save({ session });

      // Update supplier opening balance for unpaid amount
      if (supplierId) {
        const purchaseRemainingBalance = totalAmount - (paidAmount || 0);
        if (purchaseRemainingBalance > 0) {
          await Supplier.findByIdAndUpdate(supplierId, { $inc: { openingBalance: purchaseRemainingBalance } }, { session });
        }
      }

      // Update stock + collect movements
      if (stockMaintenance) {
      const purchaseProductIds = processedItems.filter(item => item.product).map(item => item.product);
      const purchaseProducts = await Product.find({ _id: { $in: purchaseProductIds }, ...baseFilter });
      const purchaseProductMap = new Map(purchaseProducts.map(p => [p._id.toString(), p]));

      const productNamesWithoutId = [...new Set(processedItems.filter(item => !item.product && item.productName).map(item => item.productName))];
      let nameProductMap = new Map();
      if (productNamesWithoutId.length > 0) {
        const nameProducts = await Product.find({ ...baseFilter, name: { $in: productNamesWithoutId } });
        nameProductMap = new Map(nameProducts.map(p => [p.name, p]));
      }

      const purchaseStockOps = [];
      const batchUpdates = [];
      const serialNumberOps = [];
      for (const item of processedItems) {
        const prod = item.product
          ? purchaseProductMap.get(item.product.toString())
          : nameProductMap.get(item.productName);

        // Services never affect stock: skip stock increment, movement, batch & serial ops.
        if (prod && prod.type === 'service') continue;

        if (prod) {
          purchaseStockOps.push({
            updateOne: {
              filter: { _id: prod._id, user: req.user._id },
              update: { $inc: { stock: item.quantity } }
            }
          });
          purchaseMovements.push({
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
            batchNo: item.batchNo || undefined,
          });
          if (item.batchNo) {
            const existingBatch = prod.batches ? prod.batches.find(b => b.batchNo === item.batchNo) : null;
            if (existingBatch) {
              existingBatch.stock = (existingBatch.stock || 0) + item.quantity;
            } else {
              if (!prod.batches) prod.batches = [];
              prod.batches.push({ batchNo: item.batchNo, stock: item.quantity });
            }
            batchUpdates.push(prod);
          }
          if (item.serialNo) {
            serialNumberOps.push({
              updateOne: {
                filter: { _id: prod._id, user: req.user._id },
                update: { $addToSet: { serialNumbers: item.serialNo } }
              }
            });
          }
        }
      }
      if (purchaseStockOps.length > 0) await Product.bulkWrite(purchaseStockOps, { session });
      for (const prod of batchUpdates) {
        await prod.save({ session });
      }
      if (serialNumberOps.length > 0) await Product.bulkWrite(serialNumberOps, { session });

      // Auto-update sale price if setting enabled
      if (setting?.preferences?.item?.updateSalePriceAuto) {
        const purchasePriceOps = processedItems
          .filter(item => item.product && item.rate)
          .map(item => ({
            updateOne: {
              filter: { _id: item.product, user: req.user._id },
              update: { $set: { price: item.rate } }
            }
          }));
        if (purchasePriceOps.length > 0) await Product.bulkWrite(purchasePriceOps, { session }).catch(() => {});
      }

      // Update weighted average cost price for each product
      for (const item of processedItems) {
        if (item.product && item.rate > 0) {
          try {
            const prod = purchaseProductMap.get(item.product.toString()) || await Product.findById(item.product);
            // Services never affect stock, so skip weighted-average cost recompute.
            if (prod && prod.type === 'service') continue;
            if (prod) {
              const totalCost = (prod.stock * (prod.costPrice || 0)) + (item.quantity * item.rate);
              const totalQty = prod.stock + item.quantity;
              prod.costPrice = totalQty > 0 ? Math.round(totalCost / totalQty * 100) / 100 : item.rate;
              await prod.save({ session });
            }
          } catch (e) { /* cost price update optional */ }
        }
      }
      }

      // Payment transaction
      if (paidAmount > 0) {
        const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';
        const [txn] = await Transaction.create([{
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
        }], { session });
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
          // Respect payment mode: cash leaves the cash account, everything else the bank account.
          const payCode = paymentMethod === 'cash' ? '1001' : '1002';
          let cash = await Account.findOne({ ...baseFilter, code: payCode });
          if (!cash) cash = await Account.findOne({ ...baseFilter, code: '1001' });
          if (cash) {
            lines[1].credit = totalAmount - paidAmount;
            lines.push({ account: cash._id, accountName: cash.name, accountType: cash.type, debit: 0, credit: paidAmount });
          }
        }
        try {
          await JournalEntry.create([{
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
          }], { session });
          const purchaseAccountIds = lines.map(l => l.account);
          const purchaseAccounts = await Account.find({ _id: { $in: purchaseAccountIds }, ...baseFilter });
          const purchaseAccountMap = new Map(purchaseAccounts.map(a => [a._id.toString(), a]));
          const purchaseBalanceOps = lines.map(line => {
            const acc = purchaseAccountMap.get(line.account.toString());
            if (!acc) return null;
            const balanceChange = ['asset', 'expense'].includes(acc.type)
              ? line.debit - line.credit
              : line.credit - line.debit;
            return {
              updateOne: {
                filter: { _id: line.account, ...baseFilter },
                update: { $inc: { balance: balanceChange } }
              }
            };
          }).filter(Boolean);
          if (purchaseBalanceOps.length > 0) await Account.bulkWrite(purchaseBalanceOps, { session });
        } catch (jeErr) {
          console.error('Failed to create journal entry for purchase:', jeErr.message);
        }
      }

      return purchase;
    });

    // External / non-atomic side effects run AFTER the transaction commits.
    // recordStockMovement cannot accept a session, so it runs here.
    for (const movement of purchaseMovements) {
      await recordStockMovement(movement);
    }

    createNotification(req.user._id, 'new_purchase', 'New Purchase Created',
      `Purchase from ${supplierName || 'supplier'} for Rs.${purchase.totalAmount?.toFixed(2) || '0'}`,
      purchase._id, 'Purchase'
    ).catch(() => {});
    // Web push for new purchase (gated by push.enabled + push.newPurchase)
    sendPushNotification(req.user._id, {
      title: 'New Purchase Created',
      body: `Purchase from ${supplierName || 'supplier'} for Rs.${purchase.totalAmount?.toFixed(2) || '0'}`,
      url: '/purchases',
    }, 'new_purchase').catch(() => {});

    sendAutoMessage(req.user._id, req.businessId, 'purchase', {
      supplierName,
      invoiceNumber: billNumber || String(purchase._id),
      invoiceId: purchase._id,
      date: date || new Date(),
      totalAmount,
      remainingBalance: totalAmount - (paidAmount || 0),
    }).catch(() => {});

    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const settingForPasscode = await Setting.findOne(getSettingQuery(req));
    const passcodeRequired = settingForPasscode?.preferences?.transaction?.passcodeForEditDelete === true;
    if (passcodeRequired && req.body.passcode) {
      const User = require('../models/User');
      const user = await User.findById(req.user._id);
      if (!user || !(await user.comparePassword(req.body.passcode))) {
        return res.status(403).json({ message: 'Invalid passcode. Edit requires passcode verification.' });
      }
    }

    const body = req.body;
    const isPaymentOnly = Object.keys(body).every(k =>
      ['paidAmount', 'paymentMethod', 'paymentDate', 'paymentStatus'].includes(k)
    );

    // Build update set with whitelist. Only fields that actually exist on the
    // Purchase schema are allowed through; bogus fields (invoiceNumber, taxAmount,
    // discount, description) silently corrupted nothing but advertised a contract
    // the model never honoured, so they are removed.
    const allowedFields = ['date', 'supplier', 'supplierName', 'billNumber', 'items', 'totalAmount', 'paidAmount', 'paymentMethod', 'paymentStatus', 'notes', 'isInterState'];
    const setFields = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) setFields[field] = body[field];
    }

    // Capture pre-edit totals so we can compute deltas for stock ledger, the
    // purchase journal entry and the purchase/payable account balances.
    const oldTotalAmount = purchase.totalAmount || 0;
    const oldPaidAmount = purchase.paidAmount || 0;
    const oldRemainingBalance = purchase.remainingBalance || 0;

    // Recompute the (server-side) total and payment fields. The total comes from
    // the incoming value when items/total change; otherwise it stays as stored.
    const newTotalAmount = setFields.totalAmount !== undefined ? (setFields.totalAmount || 0) : oldTotalAmount;
    const newPaidAmount = body.paidAmount !== undefined ? (body.paidAmount || 0) : oldPaidAmount;
    // Always recompute remaining balance + payment status whenever the total OR
    // the paid amount could have changed, not only when paidAmount is supplied,
    // so item edits flow through to the supplier payable delta.
    setFields.remainingBalance = Math.max(0, newTotalAmount - newPaidAmount);
    if (newPaidAmount >= newTotalAmount) setFields.paymentStatus = 'paid';
    else if (newPaidAmount > 0) setFields.paymentStatus = 'partial';
    else setFields.paymentStatus = 'unpaid';
    if (body.paidAmount !== undefined) setFields.paymentDate = new Date();

    // Business-aware scope for all sub-queries: staff/member users carry a
    // businessId (not their own _id), so filtering by user: req.user._id would
    // silently match nothing. Mirror the primary fetch's getBaseFilter scope.
    const scope = getBaseFilter(req);

    // Load products referenced by the existing and incoming items so we can skip
    // services (type === 'service') from any stock adjustment, and so we have the
    // names/current balances needed to write StockMovement ledger rows.
    let updateProductMap = new Map();
    let updateServiceIds = new Set();
    if (!isPaymentOnly) {
      const updateProductIds = [
        ...purchase.items.filter(item => item.product).map(item => item.product),
        ...((body.items || []).filter(item => item && item.product).map(item => item.product)),
      ];
      if (updateProductIds.length > 0) {
        const updateProducts = await Product.find({ _id: { $in: updateProductIds }, ...scope }).select('type name stock');
        updateProductMap = new Map(updateProducts.map(p => [p._id.toString(), p]));
        updateServiceIds = new Set(updateProducts.filter(p => p.type === 'service').map(p => p._id.toString()));
      }
    }

    const updated = await withTransaction(async (session) => {
      // Reverse the old stock movements first; skip services.
      const oldItems = isPaymentOnly ? [] : purchase.items;
      if (!isPaymentOnly) {
        // Restore old stock (only when items may have changed); skip services.
        const updateRestoreOps = purchase.items
          .filter(item => item.product && !updateServiceIds.has(item.product.toString()))
          .map(item => ({
            updateOne: {
              filter: { _id: item.product, ...scope },
              update: { $inc: { stock: -item.quantity } }
            }
          }));
        if (updateRestoreOps.length > 0) await Product.bulkWrite(updateRestoreOps, { session });
      }

      const updated = await Purchase.findOneAndUpdate(
        { _id: req.params.id, ...scope },
        { $set: setFields },
        { new: true, runValidators: true, session }
      );

      const newItems = isPaymentOnly ? [] : updated.items;
      if (!isPaymentOnly) {
        // Apply new stock; skip services.
        const updateApplyOps = updated.items
          .filter(item => item.product && !updateServiceIds.has(item.product.toString()))
          .map(item => ({
            updateOne: {
              filter: { _id: item.product, ...scope },
              update: { $inc: { stock: item.quantity } }
            }
          }));
        if (updateApplyOps.length > 0) await Product.bulkWrite(updateApplyOps, { session });
      }

      // Write StockMovement ledger rows for both legs so the ledger stays complete
      // on edit. recordStockMovement cannot take a session, so we build the rows
      // here (computing balanceBefore/After against the running stock per product)
      // and insert them inside the transaction. The reversal leg subtracts the old
      // quantity (type 'purchase_return'); the re-application leg adds the new
      // quantity (type 'purchase').
      const movementRows = [];
      const runningStock = new Map();
      const stockNow = (id) => {
        const key = id.toString();
        if (!runningStock.has(key)) {
          const prod = updateProductMap.get(key);
          runningStock.set(key, prod ? (prod.stock || 0) : 0);
        }
        return runningStock.get(key);
      };
      const pushMovement = (item, type, qtyDelta) => {
        const key = item.product.toString();
        const prod = updateProductMap.get(key);
        if (!prod || prod.type === 'service') return;
        const balanceBefore = stockNow(item.product);
        const balanceAfter = Math.max(0, balanceBefore + qtyDelta);
        runningStock.set(key, balanceAfter);
        movementRows.push({
          user: req.user._id,
          business: req.businessId,
          product: item.product,
          productName: prod.name || item.productName || '',
          type,
          quantity: qtyDelta,
          balanceBefore,
          balanceAfter,
          rate: item.rate || 0,
          totalAmount: item.amount || 0,
          referenceType: 'purchase',
          referenceId: updated._id,
          referenceNumber: updated.billNumber || String(updated._id),
          description: `Purchase edit reversal/re-apply for ${updated.supplierName || ''}`.trim(),
          date: new Date(),
        });
      };
      for (const item of oldItems) {
        if (item.product) pushMovement(item, 'purchase_return', -item.quantity);
      }
      for (const item of newItems) {
        if (item.product) pushMovement(item, 'purchase', item.quantity);
      }
      if (movementRows.length > 0) await StockMovement.insertMany(movementRows, { session });

      // Adjust supplier opening balance by the change in remaining (unpaid) balance.
      // Now recomputed whenever the total changes (item edits included), not only
      // when paidAmount is supplied.
      if (updated.supplier) {
        const newRemainingBalance = updated.remainingBalance || 0;
        const remainingDelta = newRemainingBalance - oldRemainingBalance;
        if (remainingDelta !== 0) {
          await Supplier.findByIdAndUpdate(updated.supplier, { $inc: { openingBalance: remainingDelta } }, { session });
        }
      }

      // Adjust the purchase journal entry + purchase/payable/cash account balances
      // by the delta so accounting stays consistent on edit. Strategy: reverse the
      // old JE's effect on every account balance, rebuild the lines from the new
      // totals, re-post them, and rewrite the JE document in place.
      const totalsChanged = newTotalAmount !== oldTotalAmount || newPaidAmount !== oldPaidAmount;
      if (totalsChanged) {
        try {
          const journalEntry = await JournalEntry.findOne({ referenceType: 'purchase', referenceId: updated._id, ...scope }).session(session);

          // Reverse the existing JE's balance effect (asset/expense: debit-credit; else credit-debit).
          if (journalEntry && journalEntry.lines.length > 0) {
            const oldAccIds = journalEntry.lines.filter(l => l.account).map(l => l.account);
            const oldAccounts = await Account.find({ _id: { $in: oldAccIds }, ...scope }).session(session);
            const oldAccMap = new Map(oldAccounts.map(a => [a._id.toString(), a]));
            const reverseOps = journalEntry.lines.filter(l => l.account).map(line => {
              const acc = oldAccMap.get(line.account.toString());
              if (!acc) return null;
              const balanceChange = ['asset', 'expense'].includes(acc.type)
                ? line.debit - line.credit
                : line.credit - line.debit;
              return {
                updateOne: {
                  filter: { _id: line.account, ...scope },
                  update: { $inc: { balance: -balanceChange } }
                }
              };
            }).filter(Boolean);
            if (reverseOps.length > 0) await Account.bulkWrite(reverseOps, { session });
          }

          // Rebuild lines from the new totals (mirrors createPurchase).
          const purchaseAccount = await Account.findOne({ ...scope, code: '5002' }).session(session);
          const payable = await Account.findOne({ ...scope, code: '2001' }).session(session);
          if (purchaseAccount && payable) {
            const newRemaining = Math.max(0, newTotalAmount - newPaidAmount);
            const lines = [
              { account: purchaseAccount._id, accountName: purchaseAccount.name, accountType: purchaseAccount.type, debit: newTotalAmount, credit: 0 },
              { account: payable._id, accountName: payable.name, accountType: payable.type, debit: 0, credit: newRemaining },
            ];
            if (newPaidAmount > 0) {
              const payCode = (updated.paymentMethod || 'cash') === 'cash' ? '1001' : '1002';
              let cash = await Account.findOne({ ...scope, code: payCode }).session(session);
              if (!cash) cash = await Account.findOne({ ...scope, code: '1001' }).session(session);
              if (cash) {
                lines.push({ account: cash._id, accountName: cash.name, accountType: cash.type, debit: 0, credit: newPaidAmount });
              }
            }

            // Post the new lines' effect on account balances.
            const newAccIds = lines.map(l => l.account);
            const newAccounts = await Account.find({ _id: { $in: newAccIds }, ...scope }).session(session);
            const newAccMap = new Map(newAccounts.map(a => [a._id.toString(), a]));
            const postOps = lines.map(line => {
              const acc = newAccMap.get(line.account.toString());
              if (!acc) return null;
              const balanceChange = ['asset', 'expense'].includes(acc.type)
                ? line.debit - line.credit
                : line.credit - line.debit;
              return {
                updateOne: {
                  filter: { _id: line.account, ...scope },
                  update: { $inc: { balance: balanceChange } }
                }
              };
            }).filter(Boolean);
            if (postOps.length > 0) await Account.bulkWrite(postOps, { session });

            const jePayload = {
              lines,
              totalDebit: lines.reduce((s, l) => s + l.debit, 0),
              totalCredit: lines.reduce((s, l) => s + l.credit, 0),
              entryDate: updated.date || new Date(),
              narration: `Purchase ${updated.billNumber || ''} - ${updated.supplierName}`,
              isPosted: true,
              postedAt: new Date(),
            };
            if (journalEntry) {
              await JournalEntry.updateOne({ _id: journalEntry._id, ...scope }, { $set: jePayload }, { session });
            } else {
              // No JE existed (e.g. created before chart-of-accounts setup); create one.
              await JournalEntry.create([{
                user: req.user._id,
                business: req.businessId,
                entryNumber: `JE-PUR-${updated.billNumber || updated._id}`,
                referenceType: 'purchase',
                referenceId: updated._id,
                ...jePayload,
              }], { session });
            }
          }
        } catch (jeErr) {
          console.error('Failed to adjust journal entry on purchase update:', jeErr.message);
        }
      }

      return updated;
    });

    createNotification(req.user._id, 'purchase_updated', 'Purchase Updated',
      `Purchase ${purchase.billNumber || ''} has been updated`,
      purchase._id, 'Purchase'
    ).catch(() => {});

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const settingForPasscode = await Setting.findOne(getSettingQuery(req));
    const passcodeRequired = settingForPasscode?.preferences?.transaction?.passcodeForEditDelete === true;
    if (passcodeRequired && req.body.passcode) {
      const User = require('../models/User');
      const user = await User.findById(req.user._id);
      if (!user || !(await user.comparePassword(req.body.passcode))) {
        return res.status(403).json({ message: 'Invalid passcode. Delete requires passcode verification.' });
      }
    }

    // Load referenced products so we can skip services (type === 'service') from stock reversal.
    const deleteProductIds = purchase.items.filter(item => item.product).map(item => item.product);
    let deleteServiceIds = new Set();
    if (deleteProductIds.length > 0) {
      const deleteProducts = await Product.find({ _id: { $in: deleteProductIds }, ...baseFilter }).select('type');
      deleteServiceIds = new Set(deleteProducts.filter(p => p.type === 'service').map(p => p._id.toString()));
    }

    await withTransaction(async (session) => {
      // Delete purchase: reverse the stock addition that happened during creation; skip services.
      const deletePOps = purchase.items
        .filter(item => item.product && !deleteServiceIds.has(item.product.toString()))
        .map(item => ({
          updateOne: {
            filter: { _id: item.product, user: req.user._id },
            update: { $inc: { stock: -item.quantity } }
          }
        }));
      if (deletePOps.length > 0) await Product.bulkWrite(deletePOps, { session });

      // Reverse supplier opening balance for the unpaid portion added at creation
      if (purchase.supplier) {
        const purchaseRemainingBalance = purchase.remainingBalance || 0;
        if (purchaseRemainingBalance > 0) {
          await Supplier.findByIdAndUpdate(purchase.supplier, { $inc: { openingBalance: -purchaseRemainingBalance } }, { session });
        }
      }

      // Reverse journal entry if one was created
      try {
        const JournalEntry = require('../models/JournalEntry');
        const Account = require('../models/Account');
        const journalEntry = await JournalEntry.findOne({ referenceType: 'purchase', referenceId: purchase._id, ...baseFilter });
        if (journalEntry) {
          const delAccIds = journalEntry.lines.filter(l => l.account).map(l => l.account);
          const delAccounts = await Account.find({ _id: { $in: delAccIds }, ...baseFilter });
          const delAccountMap = new Map(delAccounts.map(a => [a._id.toString(), a]));
          const delReverseOps = journalEntry.lines.filter(l => l.account).map(line => {
            const acc = delAccountMap.get(line.account.toString());
            if (!acc) return null;
            return {
              updateOne: {
                filter: { _id: line.account, user: req.user._id },
                update: { $inc: { balance: line.debit ? -line.debit : line.credit } }
              }
            };
          }).filter(Boolean);
          if (delReverseOps.length > 0) await Account.bulkWrite(delReverseOps, { session });
          await JournalEntry.findOneAndDelete({ _id: journalEntry._id, user: req.user._id }, { session });
        }
      } catch (jeErr) {
        console.error('Failed to reverse journal entry on purchase delete:', jeErr.message);
      }

      await Purchase.findOneAndDelete({ _id: req.params.id, ...getBaseFilter(req) }, { session });
    });

    createNotification(req.user._id, 'purchase_deleted', 'Purchase Removed',
      `Purchase from ${purchase.supplierName || 'supplier'} has been removed`,
      purchase._id, 'Purchase'
    ).catch(() => {});
    res.json({ message: 'Purchase removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findOne({ _id: req.params.id, ...getBaseFilter(req) }).populate('supplier', 'name phone');
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase };
