const PurchaseReturn = require('../models/PurchaseReturn');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPurchaseReturns = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search } = req.query;
    const filter = { ...baseFilter };
    if (search) {
      filter.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        { purchaseBillNumber: { $regex: search, $options: 'i' } },
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

    const ret = await PurchaseReturn.create({
      user: req.user._id, business: req.businessId, returnNumber, purchase, purchaseBillNumber, supplier, supplierName, returnDate: returnDate || new Date(),
      phone, invoiceDate: invoiceDate || undefined, stateOfSupply, paymentType: paymentType || 'Cash',
      roundOff, roundOffValue: roundOffVal, image,
      items: processedItems, taxableAmount, cgstTotal: cgstTotalCalc, sgstTotal: sgstTotalCalc, igstTotal: igstTotalCalc,
      totalAmount: computedTotal + roundOffVal,
      reason, notes, isInterState: isInterState || false,
    });

    for (const item of processedItems) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod ? prod.stock : 0;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: -item.quantity } });
        await StockMovement.create({
          user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
          type: 'purchase_return', quantity: -item.quantity,
          balanceBefore: balBefore, balanceAfter: balBefore - item.quantity,
          rate: item.rate, totalAmount: item.amount,
          referenceType: 'PurchaseReturn', referenceId: ret._id,
          referenceNumber: returnNumber || ret._id,
          description: `Purchase return ${returnNumber || ''} - ${supplierName || ''}`,
          date: returnDate || new Date(),
        });
      }
    }

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

    const updated = await PurchaseReturn.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, filtered, { new: true });
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

    // Restore stock that was decremented during creation
    for (const item of ret.items) {
      if (item.product) {
        const prod = await Product.findOne({ _id: item.product, user: req.user._id });
        const balBefore = prod ? prod.stock : 0;
        await Product.findOneAndUpdate({ _id: item.product, user: req.user._id }, { $inc: { stock: item.quantity } });
        await StockMovement.create({
          user: req.user._id, business: req.businessId, product: item.product, productName: item.productName,
          type: 'return', quantity: item.quantity,
          balanceBefore: balBefore, balanceAfter: balBefore + item.quantity,
          rate: item.rate, totalAmount: item.amount,
          referenceType: 'PurchaseReturn', referenceId: ret._id,
          referenceNumber: ret.returnNumber || ret._id,
          description: `Purchase return deleted - stock restored`,
          date: new Date(),
        });
      }
    }

    await PurchaseReturn.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Purchase return removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchaseReturns, getPurchaseReturnById, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn };
