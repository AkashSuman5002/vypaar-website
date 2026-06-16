const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const { recordStockMovement } = require('./stockController');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { sendAutoMessage } = require('../services/messageService');
const { createNotification } = require('./notificationController');

const getPurchaseOrders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, status, search } = req.query;
    const filter = { ...baseFilter };
    if (status) filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { orderNumber: { $regex: escaped, $options: 'i' } },
        { supplierName: { $regex: escaped, $options: 'i' } },
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
      const qty = item.qty || item.quantity || 0;
      const price = item.price || item.rate || 0;
      const gstRate = item.tax || item.gstRate || 0;
      const taxable = qty * price;
      const gstHalf = isInterState ? 0 : taxable * (gstRate / 100) / 2;
      const igstAmt = isInterState ? taxable * (gstRate / 100) : 0;
      taxableAmount += taxable;
      cgstTotal += gstHalf;
      sgstTotal += gstHalf;
      igstTotal += igstAmt;
      return {
        product: item.product, productName: item.productName,
        quantity: qty, rate: price,
        amount: taxable + gstHalf + gstHalf + igstAmt,
        gstRate,
        receivedQuantity: 0,
        pendingQuantity: qty,
      };
    });

    const order = await PurchaseOrder.create({
      ...getCreateData(req, {
        orderNumber: finalOrderNumber, supplier, supplierName, orderDate, expectedDate,
        items: processedItems, taxableAmount, cgstTotal, sgstTotal, igstTotal,
        totalAmount: taxableAmount + cgstTotal + sgstTotal + igstTotal,
        notes, isInterState: isInterState || false, status: 'draft',
      }),
    });

    sendAutoMessage(req.user._id, req.businessId, 'purchase_order', {
      supplierName, invoiceNumber: finalOrderNumber, invoiceId: order._id,
      date: orderDate || new Date(), totalAmount: order.totalAmount, remainingBalance: order.totalAmount,
    }).catch(() => {});

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
    if (order.status === 'received' || order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot edit received or cancelled orders' });
    }
    const { orderNumber, supplier, supplierName, orderDate, expectedDate, items, totalAmount, notes, isInterState } = req.body;
    const updated = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { orderNumber, supplier, supplierName, orderDate, expectedDate, items, totalAmount, notes, isInterState },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approvePurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (!['draft', 'pending'].includes(order.status)) {
      return res.status(400).json({ message: `Cannot approve order with status: ${order.status}` });
    }
    order.status = 'ordered';
    order.approvalDate = new Date();
    order.approvedBy = req.user.name || req.user.email;
    await order.save();

    createNotification(req.user._id, 'new_purchase', 'Purchase Order Approved', `Order ${order.orderNumber} has been approved`, order._id, 'PurchaseOrder');

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (order.status === 'received') {
      return res.status(400).json({ message: 'Cannot cancel a received order' });
    }
    order.status = 'cancelled';
    order.cancellationReason = req.body.reason || '';
    order.cancelledDate = new Date();
    await order.save();

    createNotification(req.user._id, 'purchase_cancelled', 'Purchase Order Cancelled', `Order ${order.orderNumber} has been cancelled`, order._id, 'PurchaseOrder');

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const receivePurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (!['ordered', 'partially_received'].includes(order.status)) {
      return res.status(400).json({ message: `Cannot receive order with status: ${order.status}` });
    }

    const { receivedItems, notes } = req.body;
    if (!receivedItems || receivedItems.length === 0) {
      return res.status(400).json({ message: 'At least one item must be received' });
    }

    let allFullyReceived = true;
    for (const received of receivedItems) {
      const orderItem = order.items.id(received.itemId) || order.items.find(i => i.product?.toString() === received.productId);
      if (!orderItem) continue;

      const recvQty = parseInt(received.receivedQuantity) || 0;
      if (recvQty <= 0) continue;

      if (recvQty > orderItem.pendingQuantity) {
        return res.status(400).json({ message: `Received quantity (${recvQty}) exceeds pending quantity (${orderItem.pendingQuantity}) for ${orderItem.productName}` });
      }

      orderItem.receivedQuantity = (orderItem.receivedQuantity || 0) + recvQty;
      orderItem.pendingQuantity = orderItem.quantity - orderItem.receivedQuantity;

      const product = await Product.findOne({ _id: orderItem.product, ...baseFilter });
      if (product) {
        await recordStockMovement({
          userId: req.user._id,
          businessId: req.businessId,
          productId: product._id,
          productName: product.name,
          type: 'purchase',
          quantity: recvQty,
          rate: orderItem.rate || 0,
          totalAmount: (orderItem.rate || 0) * recvQty,
          referenceType: 'PurchaseOrder',
          referenceId: order._id,
          referenceNumber: order.orderNumber,
          description: `Received against PO ${order.orderNumber}`,
        });
        product.stock = (product.stock || 0) + recvQty;
        await product.save();
      }

      if (orderItem.pendingQuantity > 0) allFullyReceived = false;
    }

    order.status = allFullyReceived ? 'received' : 'partially_received';
    order.receivedDate = new Date();
    order.receiveNotes = notes || '';
    await order.save();

    createNotification(req.user._id, 'new_purchase', 'Stock Received', `${order.orderNumber} - stock received`, order._id, 'PurchaseOrder');

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (order.status === 'received') {
      return res.status(400).json({ message: 'Cannot delete a received order' });
    }
    await PurchaseOrder.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Purchase order removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder,
  approvePurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
};
