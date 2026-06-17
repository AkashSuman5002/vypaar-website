const Product = require('../models/Product');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { getSettings } = require('../utils/settingsHelper');

const getProducts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { search, page = 1, limit = 50, warehouse, category } = req.query;

    let filter = { ...baseFilter };
    if (warehouse) filter.warehouse = warehouse;
    if (category) filter.category = category;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const prefs = await getSettings(req);
    if (prefs.item.enableItem === false) {
      return res.status(400).json({ message: 'Item creation is disabled in settings' });
    }
    const { name, itemType, category, price, costPrice, stock, unit, gstRate, sku, brand, hsn, description, image, supplier, warehouse, storageLocation, modelNo, size, serialNo, batchNo, expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp, openingStock } = req.body;
    const type = itemType === 'Service' ? 'service' : 'product';
    // A service must never carry inventory: force inventory-related values regardless of request.
    const inventoryFields = type === 'service'
      ? { stock: 0, minStock: 0, openingStock: 0, batchTracking: false, serialNumberTracking: false, batches: [], serialNumbers: [] }
      : { stock, minStock, openingStock };
    // Inventory-only required-field checks do not apply to services.
    if (type !== 'service') {
      if (prefs.item.batchTracking === true && !batchNo) {
        return res.status(400).json({ message: 'Batch tracking is enabled. Batch number is required' });
      }
      if (prefs.item.serialNumberTracking === true && !serialNo) {
        return res.status(400).json({ message: 'Serial number tracking is enabled. Serial number is required' });
      }
      if (prefs.item.expiryDate === true && !expiryDate) {
        return res.status(400).json({ message: 'Expiry date tracking is enabled. Expiry date is required' });
      }
      if (prefs.item.manufacturingDate === true && !mfgDate) {
        return res.status(400).json({ message: 'Manufacturing date is required' });
      }
      if (prefs.item.modelNumber === true && !modelNo) {
        return res.status(400).json({ message: 'Model number is required' });
      }
      if (prefs.item.size === true && !size) {
        return res.status(400).json({ message: 'Size is required' });
      }
      if (prefs.general.enableGodown === true && !warehouse) {
        const Godown = require('../models/Godown');
        const godownCount = await Godown.countDocuments({ user: req.user._id, business: req.businessId, isActive: true });
        if (godownCount > 0) {
          return res.status(400).json({ message: 'Godown/Warehouse assignment is required' });
        }
      }
    }
    // Category & HSN/SAC apply to both products and services.
    if (prefs.item.itemCategory === true && !category) {
      return res.status(400).json({ message: 'Item category is required' });
    }
    if (prefs.taxes.hsnSac === true && !hsn) {
      return res.status(400).json({ message: 'HSN/SAC code is required' });
    }
    const product = await Product.create({
      ...getCreateData(req),
      name, type, category, price, costPrice, unit, gstRate,
      sku, brand, hsn, description, image, supplier,
      warehouse: warehouse || undefined,
      storageLocation, modelNo, size, serialNo, batchNo,
      expiryDate, mfgDate, cgst, sgst, igst, barcode, mrp,
      ...inventoryFields,
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const prefs = await getSettings(req);
    const { name, itemType, category, price, costPrice, stock, unit, gstRate, sku, brand, hsn, description, image, supplier, warehouse, storageLocation, modelNo, size, serialNo, batchNo, expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp, openingStock } = req.body;
    const type = itemType !== undefined ? (itemType === 'Service' ? 'service' : 'product') : product.type;
    const merged = {
      name: name !== undefined ? name : product.name,
      type,
      category: category !== undefined ? category : product.category,
      price: price !== undefined ? price : product.price,
      costPrice: costPrice !== undefined ? costPrice : product.costPrice,
      stock: stock !== undefined ? stock : product.stock,
      unit: unit !== undefined ? unit : product.unit,
      gstRate: gstRate !== undefined ? gstRate : product.gstRate,
      sku: sku !== undefined ? sku : product.sku,
      brand: brand !== undefined ? brand : product.brand,
      hsn: hsn !== undefined ? hsn : product.hsn,
      description: description !== undefined ? description : product.description,
      image: image !== undefined ? image : product.image,
      supplier: supplier !== undefined ? supplier : product.supplier,
      warehouse: warehouse !== undefined ? (warehouse || undefined) : product.warehouse,
      storageLocation: storageLocation !== undefined ? storageLocation : product.storageLocation,
      modelNo: modelNo !== undefined ? modelNo : product.modelNo,
      size: size !== undefined ? size : product.size,
      serialNo: serialNo !== undefined ? serialNo : product.serialNo,
      batchNo: batchNo !== undefined ? batchNo : product.batchNo,
      expiryDate: expiryDate !== undefined ? expiryDate : product.expiryDate,
      mfgDate: mfgDate !== undefined ? mfgDate : product.mfgDate,
      cgst: cgst !== undefined ? cgst : product.cgst,
      sgst: sgst !== undefined ? sgst : product.sgst,
      igst: igst !== undefined ? igst : product.igst,
      minStock: minStock !== undefined ? minStock : product.minStock,
      barcode: barcode !== undefined ? barcode : product.barcode,
      mrp: mrp !== undefined ? mrp : product.mrp,
    };
    // A service must never carry inventory: force inventory-related fields,
    // so switching an item to Service also clears its existing inventory.
    if (type === 'service') {
      merged.stock = 0;
      merged.minStock = 0;
      merged.openingStock = 0;
      merged.batchTracking = false;
      merged.serialNumberTracking = false;
      merged.batches = [];
      merged.serialNumbers = [];
      merged.warehouse = undefined;
    } else if (openingStock !== undefined) {
      merged.openingStock = openingStock;
    }
    // Inventory-only required-field checks do not apply to services.
    if (type !== 'service') {
      if (prefs.item.batchTracking === true && !merged.batchNo) {
        return res.status(400).json({ message: 'Batch tracking is enabled. Batch number is required' });
      }
      if (prefs.item.serialNumberTracking === true && !merged.serialNo) {
        return res.status(400).json({ message: 'Serial number tracking is enabled. Serial number is required' });
      }
      if (prefs.item.expiryDate === true && !merged.expiryDate) {
        return res.status(400).json({ message: 'Expiry date tracking is enabled. Expiry date is required' });
      }
      if (prefs.item.manufacturingDate === true && !merged.mfgDate) {
        return res.status(400).json({ message: 'Manufacturing date is required' });
      }
      if (prefs.item.modelNumber === true && !merged.modelNo) {
        return res.status(400).json({ message: 'Model number is required' });
      }
      if (prefs.item.size === true && !merged.size) {
        return res.status(400).json({ message: 'Size is required' });
      }
      if (prefs.general.enableGodown === true && !merged.warehouse) {
        const Godown = require('../models/Godown');
        const godownCount = await Godown.countDocuments({ user: req.user._id, business: req.businessId, isActive: true });
        if (godownCount > 0) {
          return res.status(400).json({ message: 'Godown/Warehouse assignment is required' });
        }
      }
    }
    // Category & HSN/SAC apply to both products and services.
    if (prefs.item.itemCategory === true && !merged.category) {
      return res.status(400).json({ message: 'Item category is required' });
    }
    if (prefs.taxes.hsnSac === true && !merged.hsn) {
      return res.status(400).json({ message: 'HSN/SAC code is required' });
    }
    const updated = await Product.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, merged, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductSales = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const Sale = require('../models/Sale');
    const sales = await Sale.find({ ...baseFilter, 'items.product': req.params.id })
      .sort({ date: -1 })
      .limit(20)
      .select('invoiceNumber date totalAmount customerName items');
    const filtered = sales.map((s) => ({
      _id: s._id,
      invoiceNumber: s.invoiceNumber,
      date: s.date,
      customerName: s.customerName,
      totalAmount: s.totalAmount,
      items: s.items.filter((i) => String(i.product) === req.params.id),
    }));
    const totalQty = filtered.reduce((sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0), 0);
    const totalRevenue = filtered.reduce((sum, s) => sum + s.items.reduce((r, i) => r + i.amount, 0), 0);
    res.json({ sales: filtered, totalQty, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await Product.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLastPurchasePrice = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const Purchase = require('../models/Purchase');
    const purchase = await Purchase.findOne({
      ...baseFilter,
      'items.product': req.params.id,
    }).sort({ date: -1 });
    if (!purchase) return res.json({ lastPrice: 0 });
    const item = purchase.items.find(i => String(i.product) === req.params.id);
    res.json({ lastPrice: item ? item.rate : 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProducts, getProductById, getProductSales, createProduct, updateProduct, deleteProduct, getLastPurchasePrice };
