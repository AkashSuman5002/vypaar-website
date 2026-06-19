const Manufacturing = require('../models/Manufacturing');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const { getBaseFilter, getSettingQuery, getCreateData } = require('../utils/queryHelper');

const getManufacturingOrders = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, status, search } = req.query;
    const filter = { ...baseFilter };
    if (status) filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { orderNumber: { $regex: escaped, $options: 'i' } },
        { finishedProductName: { $regex: escaped, $options: 'i' } },
      ];
    }

    const total = await Manufacturing.countDocuments(filter);
    const orders = await Manufacturing.find(filter)
      .populate('finishedProduct', 'name unit price')
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getManufacturingOrderById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await Manufacturing.findOne({ _id: req.params.id, ...baseFilter })
      .populate('finishedProduct', 'name unit price costPrice')
      .populate('bomItems.product', 'name unit costPrice');
    if (!order) return res.status(404).json({ message: 'Manufacturing order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getNextOrderNumber = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const setting = await Setting.findOne(getSettingQuery(req));
    const prefix = setting?.preferences?.manufacturing?.orderPrefix || 'MO-';
    const lastOrder = await Manufacturing.findOne(baseFilter).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const num = parseInt(lastOrder.orderNumber.replace(prefix, '')) || 0;
      nextNum = num + 1;
    }
    res.json({ orderNumber: `${prefix}${String(nextNum).padStart(6, '0')}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createManufacturingOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let {
      orderNumber, status, date, dueDate,
      finishedProduct, finishedProductName, plannedQuantity, unit,
      bomItems, labourCost, overheadCost, notes,
    } = req.body;

    const setting = await Setting.findOne(getSettingQuery(req));
    if (!orderNumber) {
      const prefix = setting?.preferences?.manufacturing?.orderPrefix || 'MO-';
      const lastOrder = await Manufacturing.findOne(baseFilter).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const num = parseInt(lastOrder.orderNumber.replace(prefix, '')) || 0;
        nextNum = num + 1;
      }
      orderNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;
    }

    const prod = await Product.findOne({ _id: finishedProduct, ...baseFilter });
    if (!prod) return res.status(400).json({ message: 'Finished product not found' });

    let totalBomCost = 0;
    if (bomItems && bomItems.length > 0) {
      for (const bom of bomItems) {
        bom.totalCost = (bom.quantity || 0) * (bom.costPerUnit || 0);
        totalBomCost += bom.totalCost;
      }
    }

    const totalCost = totalBomCost + (labourCost || 0) + (overheadCost || 0);
    const costPerUnit = plannedQuantity > 0 ? totalCost / plannedQuantity : 0;

    const order = await Manufacturing.create({
      user: req.user._id,
      business: req.businessId,
      orderNumber, status: status || 'planned', date, dueDate,
      finishedProduct, finishedProductName: prod.name,
      plannedQuantity, producedQuantity: 0, unit: unit || prod.unit || 'pcs',
      bomItems: bomItems || [],
      totalBomCost, labourCost: labourCost || 0, overheadCost: overheadCost || 0,
      totalCost, costPerUnit,
      notes,
      createdBy: req.user.name || req.user.email,
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateManufacturingOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await Manufacturing.findOne({ _id: req.params.id, ...baseFilter });
    if (!order) return res.status(404).json({ message: 'Manufacturing order not found' });

    const fields = ['status', 'date', 'dueDate', 'plannedQuantity', 'producedQuantity', 'unit',
      'bomItems', 'labourCost', 'overheadCost', 'notes'];

    fields.forEach(f => {
      if (req.body[f] !== undefined) order[f] = req.body[f];
    });

    if (order.bomItems && order.bomItems.length > 0) {
      let totalBomCost = 0;
      for (const bom of order.bomItems) {
        bom.totalCost = (bom.quantity || 0) * (bom.costPerUnit || 0);
        totalBomCost += bom.totalCost;
      }
      order.totalBomCost = totalBomCost;
      order.totalCost = totalBomCost + (order.labourCost || 0) + (order.overheadCost || 0);
      order.costPerUnit = order.plannedQuantity > 0 ? order.totalCost / order.plannedQuantity : 0;
    }

    if (order.status === 'completed' && !order.completedDate) {
      order.completedDate = new Date();
    }

    order.updatedBy = req.user.name || req.user.email;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const completeManufacturingOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await Manufacturing.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!order) return res.status(404).json({ message: 'Manufacturing order not found' });
    if (order.status === 'completed') return res.status(400).json({ message: 'Order already completed' });

    const producedQty = req.body.producedQuantity || order.plannedQuantity;

    for (const bom of order.bomItems) {
      if (bom.product) {
        const prod = await Product.findOne({ _id: bom.product, ...baseFilter });
        if (!prod) return res.status(400).json({ message: `Raw material not found: ${bom.productName}` });
        const qtyNeeded = bom.quantity * producedQty;
        if (prod.stock < qtyNeeded) {
          return res.status(400).json({ message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}, Required: ${qtyNeeded}` });
        }
        const balBefore = prod.stock;
        await Product.findOneAndUpdate({ _id: bom.product, ...baseFilter }, { $inc: { stock: -qtyNeeded } }, { new: true });
        await StockMovement.create({
          user: req.user._id,
          business: req.businessId,
          product: bom.product,
          productName: bom.productName || prod.name,
          type: 'manufacturing',
          quantity: -qtyNeeded,
          balanceBefore: balBefore,
          balanceAfter: balBefore - qtyNeeded,
          rate: bom.costPerUnit,
          totalAmount: qtyNeeded * bom.costPerUnit,
          referenceType: 'Manufacturing',
          referenceId: order._id,
          referenceNumber: order.orderNumber,
          description: `Manufacturing ${order.orderNumber} - raw material consumed`,
          date: new Date(),
        });
      }
    }

    const finishedProd = await Product.findOne({ _id: order.finishedProduct, ...baseFilter });
    if (finishedProd) {
      const balBefore = finishedProd.stock;
      await Product.findOneAndUpdate({ _id: order.finishedProduct, ...baseFilter }, { $inc: { stock: producedQty } }, { new: true });
      await StockMovement.create({
        user: req.user._id,
        business: req.businessId,
        product: order.finishedProduct,
        productName: order.finishedProductName || finishedProd.name,
        type: 'manufacturing',
        quantity: producedQty,
        balanceBefore: balBefore,
        balanceAfter: balBefore + producedQty,
        rate: order.costPerUnit,
        totalAmount: producedQty * order.costPerUnit,
        referenceType: 'Manufacturing',
        referenceId: order._id,
        referenceNumber: order.orderNumber,
        description: `Manufacturing ${order.orderNumber} - finished goods produced`,
        date: new Date(),
      });
    }

    order.producedQuantity = producedQty;
    order.status = 'completed';
    order.completedDate = new Date();
    order.updatedBy = req.user.name || req.user.email;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteManufacturingOrder = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const order = await Manufacturing.findOne({ _id: req.params.id, ...getBaseFilter(req) });
    if (!order) return res.status(404).json({ message: 'Manufacturing order not found' });
    if (order.status === 'completed') return res.status(400).json({ message: 'Cannot delete completed order' });

    await Manufacturing.findOneAndDelete({ _id: req.params.id, ...getBaseFilter(req) });
    res.json({ message: 'Manufacturing order deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getManufacturingOrders, getManufacturingOrderById, getNextOrderNumber,
  createManufacturingOrder, updateManufacturingOrder, completeManufacturingOrder,
  deleteManufacturingOrder,
};
