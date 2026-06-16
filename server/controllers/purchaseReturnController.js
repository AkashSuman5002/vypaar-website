const PurchaseReturn = require('../models/PurchaseReturn');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { sendAutoMessage } = require('../services/messageService');
const { withTransaction } = require('../utils/withTransaction');

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
        const products = await Product.find({ _id: { $in: productIds }, user: req.user._id });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        const stockOps = [];
        const movements = [];
        for (const item of processedItems) {
          if (item.product) {
            const prod = productMap.get(item.product.toString());
            const balBefore = prod ? prod.stock : 0;
            stockOps.push({
              updateOne: {
                filter: { _id: item.product, user: req.user._id },
                update: { $inc: { stock: -item.quantity } }
              }
            });
            movements.push({
              user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
              type: 'purchase_return', quantity: -item.quantity,
              balanceBefore: balBefore, balanceAfter: balBefore - item.quantity,
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

      // A purchase return (debit note) reduces what we owe the supplier
      if (created.supplier && created.totalAmount > 0) {
        await Supplier.findByIdAndUpdate(created.supplier, { $inc: { openingBalance: -created.totalAmount } }, { session });
      }
      // NOTE: if created.supplier is not set we cannot safely identify the supplier
      // (supplierName is free text and not a reliable key), so the balance is left untouched.

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
            filter: { _id: item.product, user: req.user._id },
            update: { $inc: { stock: item.quantity } }
          }
        }));
        if (restoreOps.length > 0) await Product.bulkWrite(restoreOps, { session });

        await StockMovement.deleteMany({
          user: req.user._id,
          business: req.businessId,
          referenceType: 'PurchaseReturn',
          referenceId: ret._id,
          type: 'purchase_return',
        }, { session });

        const newItems = filtered.items;
        const newProductIds = newItems.filter(item => item.product).map(item => item.product);
        const allProductIds = [...new Set([...ret.items.filter(i => i.product).map(i => i.product), ...newProductIds])];
        const allProducts = await Product.find({ _id: { $in: allProductIds }, user: req.user._id });
        const productMap = new Map(allProducts.map(p => [p._id.toString(), p]));

        const adjustOps = [];
        const adjustMovements = [];
        for (const item of newItems) {
          if (item.product) {
            const prod = productMap.get(item.product.toString());
            const balBefore = prod ? prod.stock : 0;
            adjustOps.push({
              updateOne: {
                filter: { _id: item.product, user: req.user._id },
                update: { $inc: { stock: -item.quantity } }
              }
            });
            adjustMovements.push({
              user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
              type: 'purchase_return', quantity: -item.quantity,
              balanceBefore: balBefore, balanceAfter: balBefore - item.quantity,
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

      return await PurchaseReturn.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, filtered, { new: true, session });
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
          const prod = await Product.findOne({ _id: item.product, user: req.user._id });
          const balBefore = prod ? prod.stock : 0;
          await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: item.quantity } }, { session });
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
        await Supplier.findByIdAndUpdate(ret.supplier, { $inc: { openingBalance: ret.totalAmount } }, { session });
      }
      // NOTE: if ret.supplier is not set, nothing was decremented at creation, so nothing to reverse.

      await PurchaseReturn.findOneAndDelete({ _id: req.params.id, ...baseFilter }, { session });
    });

    res.json({ message: 'Purchase return removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchaseReturns, getPurchaseReturnById, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn };
