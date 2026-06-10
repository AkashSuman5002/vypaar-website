const PurchaseOrder = require('../models/PurchaseOrder');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPurchaseOrders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, status, search } = req.query;
    const filter = { ...baseFilter };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await PurchaseOrder.countDocuments(filter);
    const orders = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { orderNumber, supplier, supplierName, orderDate, expectedDate, items, notes, isInterState } = req.body;

    let finalOrderNumber = orderNumber;
    if (!finalOrderNumber) {
      const Setting = require('../models/Setting');
      const setting = await Setting.findOne({ user: req.user._id, ...(req.businessId ? { business: req.businessId } : {}) });
      const prefix = setting?.preferences?.transaction?.purchaseOrderPrefix || 'PO-';
      const lastOrder = await PurchaseOrder.findOne({ user: req.user._id }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastOrder?.orderNumber) {
        const num = parseInt(lastOrder.orderNumber.replace(prefix, '')) || 0;
        nextNum = num + 1;
      }
      finalOrderNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;
    }

    let taxableAmount = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const processedItems = (items || []).map((item) => {
      const taxable = (item.quantity || 0) * (item.rate || 0);
      const gstHalf = isInterState ? 0 : taxable * ((item.gstRate || 0) / 100) / 2;
      const igstAmt = isInterState ? taxable * ((item.gstRate || 0) / 100) : 0;
      taxableAmount += taxable;
      cgstTotal += gstHalf;
      sgstTotal += gstHalf;
      igstTotal += igstAmt;
      return { product: item.product, productName: item.productName, quantity: item.quantity, rate: item.rate, amount: taxable + gstHalf + gstHalf + igstAmt, gstRate: item.gstRate || 0 };
    });
    const order = await PurchaseOrder.create({
      user: req.user._id, business: req.businessId, orderNumber: finalOrderNumber, supplier, supplierName, orderDate, expectedDate,
      items: processedItems, taxableAmount, cgstTotal, sgstTotal, igstTotal,
      totalAmount: taxableAmount + cgstTotal + sgstTotal + igstTotal,
      notes, isInterState: isInterState || false,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    const { orderNumber, supplier, supplierName, orderDate, expectedDate, items, totalAmount, paidAmount, paymentStatus, status, notes, isInterState } = req.body;
    const updated = await PurchaseOrder.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, { orderNumber, supplier, supplierName, orderDate, expectedDate, items, totalAmount, paidAmount, paymentStatus, status, notes, isInterState }, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    await PurchaseOrder.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Purchase order removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder };
