const PurchaseReturn = require('../models/PurchaseReturn');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { sendAutoMessage } = require('../services/messageService');
const { createNotification } = require('./notificationController');
const { withTransaction } = require('../utils/withTransaction');
const { getNextSequence } = require('../utils/nextNumber');

// Seed value = current max numeric PRET- return number for this tenant (prefix
// stripped). Used only to seed the counter on its first use over existing data.
const PURCHASE_RETURN_PREFIX = 'PRET-';
const maxPurchaseReturnSeq = async (baseFilter) => {
  const all = await PurchaseReturn.find(baseFilter).select('returnNumber').lean();
  let max = 0;
  for (const r of all) {
    if (!r.returnNumber || !String(r.returnNumber).startsWith(PURCHASE_RETURN_PREFIX)) continue;
    const num = parseInt(String(r.returnNumber).slice(PURCHASE_RETURN_PREFIX.length), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return max;
};

const getPurchaseReturns = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search } = req.query;
    const filter = { ...baseFilter };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { returnNumber: { $regex: escaped, $options: 'i' } },
        { supplierName: { $regex: escaped, $options: 'i' } },
        { purchaseBillNumber: { $regex: escaped, $options: 'i' } },
      ];
    }
    const total = await PurchaseReturn.countDocuments(filter);
    const returns = await PurchaseReturn.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ returns, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchaseReturnById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const ret = await PurchaseReturn.findOne({ _id: req.params.id, ...baseFilter });
    if (!ret) return res.status(404).json({ message: 'Purchase return not found' });
    res.json(ret);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPurchaseReturn = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let { returnNumber, purchase, purchaseBillNumber, supplier, supplierName, returnDate, items, reason, notes, isInterState,
      phone, stateOfSupply, paymentType, roundOff, roundOffValue, invoiceDate, taxableAmount: taxableAmt, cgstTotal, sgstTotal, igstTotal, totalAmount } = req.body;

    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (typeof roundOff === 'string') roundOff = roundOff === 'true' || roundOff === '1';
    if (typeof isInterState === 'string') isInterState = isInterState === 'true' || isInterState === '1';

    let image = '';
    if (Array.isArray(req.files)) {
      const img = req.files.find(f => f.fieldname === 'image');
      if (img) image = `/uploads/${img.filename}`;
    }

    let taxableAmount = 0, cgstTotalCalc = 0, sgstTotalCalc = 0, igstTotalCalc = 0;
    const processedItems = (items || []).map((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gstRate = parseFloat(item.gstRate) || 0;
      const discountPct = parseFloat(item.discountPct) || 0;
      const gross = qty * rate;
      const discountAmt = gross * discountPct / 100;
      const taxable = gross - discountAmt;
      const taxAmt = taxable * gstRate / 100;
      const amount = taxable + taxAmt;
      taxableAmount += taxable;
      cgstTotalCalc += isInterState ? 0 : taxAmt / 2;
      sgstTotalCalc += isInterState ? 0 : taxAmt / 2;
      igstTotalCalc += isInterState ? taxAmt : 0;
      return {
        product: item.product, productName: item.productName, quantity: qty, rate,
        amount, gstRate, unit: item.unit || 'pcs', hsn: item.hsn || '',
        discountPct, discountAmount: discountAmt, taxAmount: taxAmt, taxableAmount: taxable,
      };
    });

    const computedTotal = taxableAmount + cgstTotalCalc + sgstTotalCalc + igstTotalCalc;
    const roundOffVal = roundOff ? Math.round(computedTotal) - computedTotal : (parseFloat(roundOffValue) || 0);

    const ret = await withTransaction(async (session) => {
      // Honor a client-supplied return number; otherwise allocate one atomically
      // from the per-tenant counter inside this transaction (no read-max-then-+1
      // race). Re-resolved each attempt since the transaction may retry.
      if (!req.body.returnNumber) {
        const retSeq = await getNextSequence(
          { user: req.user._id, business: req.businessId },
          'purchase_return',
          { session, seedFn: () => maxPurchaseReturnSeq(baseFilter) },
        );
        returnNumber = `${PURCHASE_RETURN_PREFIX}${String(retSeq).padStart(6, '0')}`;
      }
      const [created] = await PurchaseReturn.create([{
        user: req.user._id, business: req.businessId, returnNumber, purchase, purchaseBillNumber, supplier, supplierName, returnDate: returnDate || new Date(),
        phone, invoiceDate: invoiceDate || undefined, stateOfSupply, paymentType: paymentType || 'Cash',
        roundOff, roundOffValue: roundOffVal, image,
        items: processedItems, taxableAmount, cgstTotal: cgstTotalCalc, sgstTotal: sgstTotalCalc, igstTotal: igstTotalCalc,
        totalAmount: computedTotal + roundOffVal,
        reason, notes, isInterState: isInterState || false,
      }], { session });

      const productIds = processedItems.filter(item => item.product).map(item => item.product);
      if (productIds.length > 0) {
        const products = await Product.find({ _id: { $in: productIds }, ...baseFilter });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        const stockOps = [];
        const movements = [];
        for (const item of processedItems) {
          if (item.product) {
            const prod = productMap.get(item.product.toString());
            const balBefore = prod ? prod.stock : 0;
            // Returning goods to the supplier decrements our stock. Guard against going
            // negative: bulkWrite's $inc bypasses the schema's min:0, so clamp the
            // decrement to the available balance to avoid silently negative stock.
            const decQty = Math.min(item.quantity, balBefore);
            stockOps.push({
              updateOne: {
                filter: { _id: item.product, ...baseFilter },
                update: { $inc: { stock: -decQty } }
              }
            });
            movements.push({
              user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
              type: 'purchase_return', quantity: -decQty,
              balanceBefore: balBefore, balanceAfter: balBefore - decQty,
              rate: item.rate, totalAmount: item.amount,
              referenceType: 'PurchaseReturn', referenceId: created._id,
              referenceNumber: returnNumber || created._id,
              description: `Purchase return ${returnNumber || ''} - ${supplierName || ''}`,
              date: returnDate || new Date(),
            });
          }
        }
        if (stockOps.length > 0) await Product.bulkWrite(stockOps, { session });
        if (movements.length > 0) await StockMovement.insertMany(movements, { session });
      }

      // A purchase return (debit note) reduces what we owe the supplier.
      // Scope the lookup by business (not just user) so staff/member users of a
      // multi-user business can adjust the owner-owned supplier balance.
      if (created.supplier && created.totalAmount > 0) {
        await Supplier.findOneAndUpdate({ _id: created.supplier, ...baseFilter }, { $inc: { openingBalance: -created.totalAmount } }, { session });
      } else if (!created.supplier && created.totalAmount > 0) {
        // Intentional skip: no linked supplier doc (supplierName is free text and not a
        // reliable key), so there is no balance to adjust. Skipping here is correct and
        // does NOT overstate any supplier balance because none was identified.
        console.warn(`Purchase return ${returnNumber || created._id}: no linked supplier (free-text supplierName only) - payable balance left untouched.`);
      }

      // Post a journal entry that REVERSES the original purchase posting.
      // Original purchase: Dr Purchase (5002) / Cr Payable (2001).
      // Purchase return (debit note): Dr Payable (2001) / Cr Purchase (5002).
      if (created.totalAmount > 0) {
        try {
          const payable = await Account.findOne({ ...baseFilter, code: '2001' });
          const purchaseAccount = await Account.findOne({ ...baseFilter, code: '5002' });
          if (payable && purchaseAccount) {
            const lines = [
              { account: payable._id, accountName: payable.name, accountType: payable.type, debit: created.totalAmount, credit: 0 },
              { account: purchaseAccount._id, accountName: purchaseAccount.name, accountType: purchaseAccount.type, debit: 0, credit: created.totalAmount },
            ];
            await JournalEntry.create([getCreateData(req, {
              entryNumber: `JE-PRET-${returnNumber || created._id}`,
              entryDate: created.returnDate || new Date(),
              referenceType: 'PurchaseReturn',
              referenceId: created._id,
              lines,
              totalDebit: created.totalAmount,
              totalCredit: created.totalAmount,
              narration: `Purchase return ${returnNumber || ''} - ${supplierName || ''}`,
              isPosted: true,
              postedAt: new Date(),
            })], { session });
            const accIds = lines.map(l => l.account);
            const accounts = await Account.find({ _id: { $in: accIds }, ...baseFilter });
            const accMap = new Map(accounts.map(a => [a._id.toString(), a]));
            const balanceOps = lines.map(line => {
              const acc = accMap.get(line.account.toString());
              if (!acc) return null;
              const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
              return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
            }).filter(Boolean);
            if (balanceOps.length > 0) await Account.bulkWrite(balanceOps, { session });
          }
        } catch (jeErr) {
          console.error('Failed to create journal entry for purchase return:', jeErr.message);
          throw jeErr;
        }
      }

      return created;
    });

    sendAutoMessage(req.user._id, req.businessId, 'purchase_return', {
      supplierName,
      invoiceNumber: returnNumber || String(ret._id),
      invoiceId: ret._id,
      date: returnDate || new Date(),
      totalAmount: ret.totalAmount,
      remainingBalance: 0,
    }).catch(() => {});

    createNotification(req.user._id, 'purchase_return', 'Purchase Return Created',
      `Return ${returnNumber || String(ret._id)} for Rs.${(ret.totalAmount || 0).toFixed(2)}${supplierName ? ` - ${supplierName}` : ''}`,
      ret._id, 'PurchaseReturn'
    ).catch(() => {});

    res.status(201).json(ret);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePurchaseReturn = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const ret = await PurchaseReturn.findOne({ _id: req.params.id, ...baseFilter });
    if (!ret) return res.status(404).json({ message: 'Purchase return not found' });

    const updateData = { ...req.body };
    if (typeof updateData.items === 'string') {
      try { updateData.items = JSON.parse(updateData.items); } catch { updateData.items = ret.items; }
    }
    if (typeof updateData.roundOff === 'string') updateData.roundOff = updateData.roundOff === 'true' || updateData.roundOff === '1';
    if (typeof updateData.isInterState === 'string') updateData.isInterState = updateData.isInterState === 'true' || updateData.isInterState === '1';

    if (Array.isArray(req.files)) {
      const img = req.files.find(f => f.fieldname === 'image');
      if (img) updateData.image = `/uploads/${img.filename}`;
    }

    const allowedFields = ['returnNumber', 'supplier', 'supplierName', 'purchaseBillNumber', 'returnDate', 'items', 'totalAmount', 'taxableAmount', 'cgstTotal', 'sgstTotal', 'igstTotal', 'taxTotal', 'roundOff', 'roundOffEnabled', 'isInterState', 'notes', 'reason', 'status', 'image'];
    const filtered = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) filtered[field] = updateData[field];
    }

    const itemsChanged = filtered.items && JSON.stringify(filtered.items) !== JSON.stringify(ret.items);

    const updated = await withTransaction(async (session) => {
      if (itemsChanged) {
        const restoreOps = ret.items.filter(item => item.product).map(item => ({
          updateOne: {
            filter: { _id: item.product, ...baseFilter },
            update: { $inc: { stock: item.quantity } }
          }
        }));
        if (restoreOps.length > 0) await Product.bulkWrite(restoreOps, { session });

        await StockMovement.deleteMany({
          ...baseFilter,
          referenceType: 'PurchaseReturn',
          referenceId: ret._id,
          type: 'purchase_return',
        }, { session });

        const newItems = filtered.items;
        const newProductIds = newItems.filter(item => item.product).map(item => item.product);
        const allProductIds = [...new Set([...ret.items.filter(i => i.product).map(i => i.product), ...newProductIds])];
        const allProducts = await Product.find({ _id: { $in: allProductIds }, ...baseFilter });
        const productMap = new Map(allProducts.map(p => [p._id.toString(), p]));

        const adjustOps = [];
        const adjustMovements = [];
        for (const item of newItems) {
          if (item.product) {
            const prod = productMap.get(item.product.toString());
            const balBefore = prod ? prod.stock : 0;
            // Guard against negative stock: bulkWrite bypasses schema min:0.
            const decQty = Math.min(item.quantity, balBefore);
            adjustOps.push({
              updateOne: {
                filter: { _id: item.product, ...baseFilter },
                update: { $inc: { stock: -decQty } }
              }
            });
            adjustMovements.push({
              user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
              type: 'purchase_return', quantity: -decQty,
              balanceBefore: balBefore, balanceAfter: balBefore - decQty,
              rate: item.rate, totalAmount: item.amount,
              referenceType: 'PurchaseReturn', referenceId: ret._id,
              referenceNumber: filtered.returnNumber || ret.returnNumber || ret._id,
              description: `Purchase return updated - ${filtered.supplierName || ret.supplierName || ''}`,
              date: filtered.returnDate || ret.returnDate || new Date(),
            });
          }
        }
        if (adjustOps.length > 0) await Product.bulkWrite(adjustOps, { session });
        if (adjustMovements.length > 0) await StockMovement.insertMany(adjustMovements, { session });
      }

      const result = await PurchaseReturn.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, filtered, { new: true, session });

      // Keep the double-entry ledger consistent: reverse the existing return JE and
      // re-post a fresh one reflecting the updated total (mirrors purchase return create).
      const newTotal = result.totalAmount || 0;
      if (newTotal !== (ret.totalAmount || 0)) {
        try {
          const existingJe = await JournalEntry.findOne({ referenceType: 'PurchaseReturn', referenceId: ret._id, ...baseFilter });
          if (existingJe) {
            const revAccIds = existingJe.lines.filter(l => l.account).map(l => l.account);
            const revAccounts = await Account.find({ _id: { $in: revAccIds }, ...baseFilter });
            const revAccMap = new Map(revAccounts.map(a => [a._id.toString(), a]));
            const revOps = existingJe.lines.filter(l => l.account).map(line => {
              const acc = revAccMap.get(line.account.toString());
              if (!acc) return null;
              const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
              return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: -change } } } };
            }).filter(Boolean);
            if (revOps.length > 0) await Account.bulkWrite(revOps, { session });
            await JournalEntry.findOneAndDelete({ _id: existingJe._id, ...baseFilter }, { session });
          }
          if (newTotal > 0) {
            const payable = await Account.findOne({ ...baseFilter, code: '2001' });
            const purchaseAccount = await Account.findOne({ ...baseFilter, code: '5002' });
            if (payable && purchaseAccount) {
              const lines = [
                { account: payable._id, accountName: payable.name, accountType: payable.type, debit: newTotal, credit: 0 },
                { account: purchaseAccount._id, accountName: purchaseAccount.name, accountType: purchaseAccount.type, debit: 0, credit: newTotal },
              ];
              await JournalEntry.create([getCreateData(req, {
                entryNumber: `JE-PRET-${result.returnNumber || result._id}`,
                entryDate: result.returnDate || new Date(),
                referenceType: 'PurchaseReturn',
                referenceId: result._id,
                lines,
                totalDebit: newTotal,
                totalCredit: newTotal,
                narration: `Purchase return updated ${result.returnNumber || ''} - ${result.supplierName || ''}`,
                isPosted: true,
                postedAt: new Date(),
              })], { session });
              const accounts = await Account.find({ _id: { $in: lines.map(l => l.account) }, ...baseFilter });
              const accMap = new Map(accounts.map(a => [a._id.toString(), a]));
              const balanceOps = lines.map(line => {
                const acc = accMap.get(line.account.toString());
                if (!acc) return null;
                const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
                return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
              }).filter(Boolean);
              if (balanceOps.length > 0) await Account.bulkWrite(balanceOps, { session });
            }
          }
        } catch (jeErr) {
          console.error('Failed to update journal entry for purchase return:', jeErr.message);
          throw jeErr;
        }
      }

      return result;
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePurchaseReturn = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const ret = await PurchaseReturn.findOne({ _id: req.params.id, ...baseFilter });
    if (!ret) return res.status(404).json({ message: 'Purchase return not found' });

    await withTransaction(async (session) => {
      // Restore stock that was decremented during creation
      for (const item of ret.items) {
        if (item.product) {
          const prod = await Product.findOne({ _id: item.product, ...baseFilter });
          const balBefore = prod ? prod.stock : 0;
          await Product.findOneAndUpdate({ _id: item.product, ...baseFilter }, { $inc: { stock: item.quantity } }, { session });
          const movement = new StockMovement({
            user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
            type: 'return', quantity: item.quantity,
            balanceBefore: balBefore, balanceAfter: balBefore + item.quantity,
            rate: item.rate, totalAmount: item.amount,
            referenceType: 'PurchaseReturn', referenceId: ret._id,
            referenceNumber: ret.returnNumber || ret._id,
            description: `Purchase return deleted - stock restored`,
            date: new Date(),
          });
          await movement.save({ session });
        }
      }

      // Reverse the supplier payable reduction applied at creation
      if (ret.supplier && ret.totalAmount > 0) {
        await Supplier.findOneAndUpdate({ _id: ret.supplier, ...baseFilter }, { $inc: { openingBalance: ret.totalAmount } }, { session });
      }
      // NOTE: if ret.supplier is not set, nothing was decremented at creation, so nothing to reverse.

      // Reverse the journal entry created for this purchase return, if any.
      try {
        const journalEntry = await JournalEntry.findOne({ referenceType: 'PurchaseReturn', referenceId: ret._id, ...baseFilter });
        if (journalEntry) {
          const delAccIds = journalEntry.lines.filter(l => l.account).map(l => l.account);
          const delAccounts = await Account.find({ _id: { $in: delAccIds }, ...baseFilter });
          const delAccMap = new Map(delAccounts.map(a => [a._id.toString(), a]));
          const delReverseOps = journalEntry.lines.filter(l => l.account).map(line => {
            const acc = delAccMap.get(line.account.toString());
            if (!acc) return null;
            const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
            return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: -change } } } };
          }).filter(Boolean);
          if (delReverseOps.length > 0) await Account.bulkWrite(delReverseOps, { session });
          await JournalEntry.findOneAndDelete({ _id: journalEntry._id, ...baseFilter }, { session });
        }
      } catch (jeErr) {
        console.error('Failed to reverse journal entry on purchase return delete:', jeErr.message);
        throw jeErr;
      }

      await PurchaseReturn.findOneAndDelete({ _id: req.params.id, ...baseFilter }, { session });
    });

    res.json({ message: 'Purchase return removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchaseReturns, getPurchaseReturnById, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn };
