const Product = require('../models/Product');
const BarcodeImport = require('../models/BarcodeImport');
const BarcodeImportLog = require('../models/BarcodeImportLog');
const BarcodeScanHistory = require('../models/BarcodeScanHistory');
const { validateBarcode, detectFormat, generateSKU, parseBarcodeCSVRow, validateImportRow } = require('../utils/barcodeUtils');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { MultiFormatReader, BarcodeFormat } = require('@zxing/library');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getUserId = (req) => req.user?._id || req.user?.id;

const decodeImage = async (imagePath) => {
  try {
    const Jimp = require('jimp');
    const image = await Jimp.read(imagePath);
    const { width, height } = image.bitmap;
    const raw = image.bitmap.data;
    const luminance = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      luminance[i] = (raw[idx] * 0.299 + raw[idx + 1] * 0.587 + raw[idx + 2] * 0.114);
    }
    const zxing = require('@zxing/library');
    const { RGBLuminanceSource, BinaryBitmap, HybridBinarizer, DecodeHintType } = zxing;
    const source = new RGBLuminanceSource(luminance, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const reader = new zxing.MultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8, zxing.BarcodeFormat.UPC_A,
      zxing.BarcodeFormat.UPC_E, zxing.BarcodeFormat.CODE_128, zxing.BarcodeFormat.CODE_39, zxing.BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    const result = reader.decode(bitmap);
    return result ? { barcode: result.getText(), format: result.getBarcodeFormat().toString() } : null;
  } catch (e) {
    return null;
  }
};

const scanBarcode = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { barcode, format, method } = req.body;
    if (!barcode) return res.status(400).json({ message: 'Barcode is required' });
    const validation = validateBarcode(barcode);
    if (!validation.valid) return res.status(400).json({ message: validation.error });
    const cleaned = validation.cleaned;
    const detectedFormat = format || detectFormat(cleaned);
    const userId = getUserId(req);
    let product = await Product.findOne({ ...baseFilter, barcode: cleaned });
    await BarcodeScanHistory.create({
      user: userId, business: req.businessId,
      barcode: cleaned,
      format: detectedFormat,
      method: method || 'camera',
      product: product?._id || null,
      productFound: !!product,
      action: product ? 'viewed' : 'ignored',
    });
    res.json({
      found: !!product,
      barcode: cleaned,
      format: detectedFormat,
      product: product || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const lookupBarcode = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ message: 'Barcode is required' });
    const validation = validateBarcode(barcode);
    if (!validation.valid) return res.status(400).json({ message: validation.error });
    const cleaned = validation.cleaned;
    const product = await Product.findOne({ ...baseFilter, barcode: cleaned });
    if (product) {
      return res.json({ found: true, product });
    }
    return res.json({ found: false, product: null });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const uploadBarcodeImage = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    if (!req.file) return res.status(400).json({ message: 'Image file is required' });
    const imagePath = req.file.path;
    const decoded = await decodeImage(imagePath);
    if (!decoded) {
      fs.unlinkSync(imagePath);
      return res.status(400).json({ message: 'Could not decode barcode from image', decoded: false });
    }
    const validation = validateBarcode(decoded.barcode);
    if (!validation.valid) {
      fs.unlinkSync(imagePath);
      return res.status(400).json({ message: validation.error, decoded: true, barcode: decoded.barcode });
    }
    const userId = getUserId(req);
    const product = await Product.findOne({ ...baseFilter, barcode: validation.cleaned });
    await BarcodeScanHistory.create({
      user: userId, business: req.businessId,
      barcode: validation.cleaned,
      format: decoded.format,
      method: 'image',
      product: product?._id || null,
      productFound: !!product,
      action: product ? 'viewed' : 'ignored',
    });
    res.json({
      decoded: true,
      barcode: validation.cleaned,
      format: decoded.format,
      found: !!product,
      product,
      imagePath: `/uploads/barcodes/${req.file.filename}`,
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const previewCSV = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    if (!req.file) return res.status(400).json({ message: 'File is required' });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];
    let headers = [];
    if (ext === '.csv') {
      const csvData = fs.readFileSync(filePath, 'utf8');
      const lines = csvData.split('\n').filter(l => l.trim());
      if (lines.length === 0) return res.status(400).json({ message: 'CSV file is empty' });
      headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        if (values.some(v => v)) rows.push(values);
      }
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (jsonData.length === 0) return res.status(400).json({ message: 'File is empty' });
      headers = jsonData[0].map(h => String(h).trim());
      for (let i = 1; i < jsonData.length; i++) {
        const values = jsonData[i].map(v => String(v).trim());
        if (values.some(v => v)) rows.push(values);
      }
    }
    const detectedFields = ['barcode', 'name', 'sku', 'category', 'purchasePrice', 'salePrice', 'gstRate', 'stock', 'unit'];
    const autoMapping = {};
    const headerLower = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
    for (const field of detectedFields) {
      const fieldLower = field.toLowerCase();
      const idx = headerLower.findIndex(h => h === fieldLower || h.includes(fieldLower) || fieldLower.includes(h));
      if (idx !== -1) autoMapping[headers[idx]] = field;
    }
    const barcodeIdx = headers.findIndex((_, i) => Object.values(autoMapping).includes('barcode') ? Object.keys(autoMapping)[i] === 'barcode' : false);
    const nameIdx = headers.findIndex((_, i) => Object.values(autoMapping).includes('name'));
    const mappedRows = rows.map((row, idx) => {
      const mapped = {};
      for (const [csvCol, dbField] of Object.entries(autoMapping)) {
        const colIdx = headers.indexOf(csvCol);
        if (colIdx !== -1 && row[colIdx]) mapped[dbField] = row[colIdx];
      }
      const errors = validateImportRow(mapped);
      return { rowNumber: idx + 2, data: mapped, valid: errors.length === 0, errors };
    });
    const validRows = mappedRows.filter(r => r.valid);
    const userId = getUserId(req);
    const existingBarcodes = await Product.find({
      ...baseFilter,
      barcode: { $in: validRows.map(r => r.data.barcode).filter(Boolean) },
    }).select('barcode name');
    const existingMap = {};
    existingBarcodes.forEach(p => { existingMap[p.barcode] = p; });
    const summary = {
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: mappedRows.filter(r => !r.valid).length,
      duplicateBarcodes: 0,
      newProducts: 0,
      existingProducts: existingBarcodes.length,
    };
    const barcodeCounts = {};
    validRows.forEach(r => {
      if (r.data.barcode) {
        barcodeCounts[r.data.barcode] = (barcodeCounts[r.data.barcode] || 0) + 1;
        if (existingMap[r.data.barcode]) r.existing = true;
        else r.existing = false;
      }
    });
    summary.duplicateBarcodes = Object.values(barcodeCounts).filter(c => c > 1).length;
    summary.newProducts = validRows.filter(r => !r.existing).length;
    const importRecord = await BarcodeImport.create({
      user: userId, business: req.businessId,
      method: 'csv',
      status: 'previewing',
      summary,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
    res.json({
      importId: importRecord._id,
      headers,
      rows: mappedRows,
      autoMapping,
      summary,
      existingProducts: existingBarcodes.map(p => ({ barcode: p.barcode, name: p.name })),
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const executeCSV = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { importId, mapping, options, stockUpdateMode, priceUpdateMode, duplicateHandling } = req.body;
    if (!importId) return res.status(400).json({ message: 'Import ID is required' });
    const userId = getUserId(req);
    const importRecord = await BarcodeImport.findOne({ _id: importId, ...baseFilter });
    if (!importRecord) return res.status(404).json({ message: 'Import record not found' });
    importRecord.status = 'importing';
    importRecord.options = options || importRecord.options;
    importRecord.stockUpdateMode = stockUpdateMode || importRecord.stockUpdateMode;
    importRecord.priceUpdateMode = priceUpdateMode || importRecord.priceUpdateMode;
    importRecord.duplicateHandling = duplicateHandling || importRecord.duplicateHandling;
    await importRecord.save();
    const startTime = Date.now();
    let productsCreated = 0, productsUpdated = 0, productsSkipped = 0, errors = 0, warnings = 0;
    const logs = [];
    const validRows = req.body.rows || [];
    for (const row of validRows) {
      try {
        const barcode = row.data?.barcode;
        if (!barcode) { errors++; logs.push({ rowNumber: row.rowNumber, barcode: '', action: 'error', reason: 'Missing barcode' }); continue; }
        const validation = validateBarcode(barcode);
        if (!validation.valid) { errors++; logs.push({ rowNumber: row.rowNumber, barcode, action: 'error', reason: validation.error }); continue; }
        const existingProduct = await Product.findOne({ ...baseFilter, barcode: validation.cleaned });
        if (existingProduct) {
          if (options?.skipDuplicates) {
            productsSkipped++;
            logs.push({ rowNumber: row.rowNumber, barcode, productName: existingProduct.name, action: 'skipped', reason: 'Duplicate barcode skipped' });
            continue;
          }
          if (options?.updateExisting || duplicateHandling === 'update' || duplicateHandling === 'replace') {
            const updateData = {};
            if (row.data.name) updateData.name = row.data.name;
            if (row.data.category) updateData.category = row.data.category;
            if (row.data.sku) updateData.sku = row.data.sku;
            if (row.data.unit) updateData.unit = row.data.unit;
            if (options?.updatePrices || priceUpdateMode === 'sale_price') {
              if (row.data.salePrice) updateData.price = parseFloat(row.data.salePrice);
              if (row.data.purchasePrice) updateData.costPrice = parseFloat(row.data.purchasePrice);
              if (row.data.mrp) updateData.mrp = parseFloat(row.data.mrp);
            }
            if (row.data.mrp && !updateData.price) updateData.mrp = parseFloat(row.data.mrp);
            if (options?.updateStock && row.data.stock !== undefined) {
              const qty = parseFloat(row.data.stock);
              if (stockUpdateMode === 'add') updateData.stock = (existingProduct.stock || 0) + qty;
              else if (stockUpdateMode === 'replace') updateData.stock = qty;
              else if (stockUpdateMode === 'adjust') updateData.stock = Math.max(0, (existingProduct.stock || 0) + qty);
              else if (stockUpdateMode === 'set_exact') updateData.stock = qty;
            }
            if (options?.updateGST && row.data.gstRate !== undefined) updateData.gstRate = parseFloat(row.data.gstRate);
            if (row.data.hsn) updateData.hsn = row.data.hsn;
            if (row.data.brand) updateData.brand = row.data.brand;
            if (row.data.description) updateData.description = row.data.description;
            updateData.minStock = row.data.minStock !== undefined ? parseFloat(row.data.minStock) : existingProduct.minStock;
            if (duplicateHandling === 'replace') {
              await Product.findOneAndDelete({ _id: existingProduct._id, user: userId });
              const newProduct = await Product.create({
                user: userId, business: req.businessId,
                name: row.data.name || existingProduct.name,
                barcode: validation.cleaned,
                category: row.data.category || existingProduct.category,
                sku: row.data.sku || existingProduct.sku,
                price: row.data.salePrice ? parseFloat(row.data.salePrice) : existingProduct.price,
                costPrice: row.data.purchasePrice ? parseFloat(row.data.purchasePrice) : existingProduct.costPrice,
                stock: row.data.stock !== undefined ? parseFloat(row.data.stock) : existingProduct.stock,
                unit: row.data.unit || existingProduct.unit,
                gstRate: row.data.gstRate !== undefined ? parseFloat(row.data.gstRate) : existingProduct.gstRate,
                minStock: row.data.minStock !== undefined ? parseFloat(row.data.minStock) : existingProduct.minStock,
                hsn: row.data.hsn || existingProduct.hsn,
                brand: row.data.brand || existingProduct.brand,
                mrp: row.data.mrp !== undefined ? parseFloat(row.data.mrp) : existingProduct.mrp,
                description: row.data.description || existingProduct.description,
              });
              productsCreated++;
              logs.push({ rowNumber: row.rowNumber, barcode, productName: newProduct.name, action: 'replaced', reason: 'Existing product replaced' });
            } else {
              await Product.findOneAndUpdate({ _id: existingProduct._id, user: userId }, updateData, { new: true });
              productsUpdated++;
              logs.push({ rowNumber: row.rowNumber, barcode, productName: existingProduct.name, action: 'updated', reason: 'Product updated' });
            }
          } else {
            productsSkipped++;
            logs.push({ rowNumber: row.rowNumber, barcode, productName: existingProduct.name, action: 'skipped', reason: 'Existing product unchanged' });
          }
        } else {
          if (options?.createNew !== false) {
            const newProduct = await Product.create({
              user: userId, business: req.businessId,
              name: row.data.name || `Product (${validation.cleaned})`,
              barcode: validation.cleaned,
              category: row.data.category || '',
              sku: row.data.sku || generateSKU(row.data.name, row.data.category, validation.cleaned),
              price: row.data.salePrice ? parseFloat(row.data.salePrice) : 0,
              costPrice: row.data.purchasePrice ? parseFloat(row.data.purchasePrice) : 0,
              stock: row.data.stock !== undefined ? parseFloat(row.data.stock) : 0,
              unit: row.data.unit || 'pcs',
              gstRate: row.data.gstRate !== undefined ? parseFloat(row.data.gstRate) : 0,
              minStock: row.data.minStock !== undefined ? parseFloat(row.data.minStock) : 5,
              hsn: row.data.hsn || '',
              brand: row.data.brand || '',
              mrp: row.data.mrp !== undefined ? parseFloat(row.data.mrp) : 0,
              description: row.data.description || '',
            });
            productsCreated++;
            logs.push({ rowNumber: row.rowNumber, barcode, productName: newProduct.name, action: 'created', reason: 'New product created' });
          } else {
            productsSkipped++;
            logs.push({ rowNumber: row.rowNumber, barcode, action: 'skipped', reason: 'Create new products disabled' });
          }
        }
      } catch (rowErr) {
        errors++;
        logs.push({ rowNumber: row.rowNumber, barcode: row.data?.barcode || '', action: 'error', reason: rowErr.message });
      }
    }
    const duration = Date.now() - startTime;
    importRecord.status = errors > 0 && productsCreated === 0 ? 'failed' : errors > 0 ? 'partial' : 'completed';
    importRecord.summary.productsCreated = productsCreated;
    importRecord.summary.productsUpdated = productsUpdated;
    importRecord.summary.productsSkipped = productsSkipped;
    importRecord.summary.errors = errors;
    importRecord.summary.warnings = warnings;
    importRecord.importDuration = duration;
    importRecord.completedAt = new Date();
    await importRecord.save();
    if (logs.length > 0) {
      await BarcodeImportLog.insertMany(logs.map(l => ({ ...l, user: userId, business: req.businessId, importId: importRecord._id })));
    }
    if (req.body.filePath && fs.existsSync(req.body.filePath)) fs.unlinkSync(req.body.filePath);
    res.json({
      message: 'Import completed',
      import: importRecord,
      summary: importRecord.summary,
      duration,
      logCount: logs.length,
    });
  } catch (err) {
    if (req.body?.filePath && fs.existsSync(req.body.filePath)) fs.unlinkSync(req.body.filePath);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const bulkImport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = getUserId(req);
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }
    if (products.length > 10000) return res.status(400).json({ message: 'Maximum 10,000 products per bulk import' });
    const importRecord = await BarcodeImport.create({
      user: userId, business: req.businessId,
      method: 'bulk_sheet',
      status: 'importing',
      summary: { totalRows: products.length },
    });
    const startTime = Date.now();
    let created = 0, updated = 0, skipped = 0, errors = 0;
    const logs = [];
    for (const item of products) {
      try {
        const validation = item.barcode ? validateBarcode(item.barcode) : { valid: false };
        const barcode = validation.valid ? validation.cleaned : null;
        const existing = barcode ? await Product.findOne({ ...baseFilter, barcode }) : null;
        if (existing) {
          const updateData = {};
          if (item.name) updateData.name = item.name;
          if (item.category) updateData.category = item.category;
          if (item.sku) updateData.sku = item.sku;
          if (item.salePrice !== undefined) updateData.price = parseFloat(item.salePrice);
          if (item.purchasePrice !== undefined) updateData.costPrice = parseFloat(item.purchasePrice);
          if (item.mrp !== undefined) updateData.mrp = parseFloat(item.mrp);
          if (item.stock !== undefined) updateData.stock = parseFloat(item.stock);
          if (item.gstRate !== undefined) updateData.gstRate = parseFloat(item.gstRate);
          if (item.unit) updateData.unit = item.unit;
          if (item.hsn) updateData.hsn = item.hsn;
          if (item.brand) updateData.brand = item.brand;
          await Product.findOneAndUpdate({ _id: existing._id, user: userId }, updateData, { new: true });
          updated++;
          logs.push({ barcode, productName: item.name || existing.name, action: 'updated' });
        } else {
          await Product.create({
            user: userId, business: req.businessId,
            name: item.name || `Product (${barcode || 'unknown'})`,
            barcode: barcode || '',
            category: item.category || '',
            sku: item.sku || generateSKU(item.name, item.category, barcode),
            price: item.salePrice ? parseFloat(item.salePrice) : 0,
            costPrice: item.purchasePrice ? parseFloat(item.purchasePrice) : 0,
            stock: item.stock !== undefined ? parseFloat(item.stock) : 0,
            unit: item.unit || 'pcs',
            gstRate: item.gstRate !== undefined ? parseFloat(item.gstRate) : 0,
            minStock: item.minStock !== undefined ? parseFloat(item.minStock) : 5,
            hsn: item.hsn || '',
            brand: item.brand || '',
            mrp: item.mrp !== undefined ? parseFloat(item.mrp) : 0,
            description: item.description || '',
          });
          created++;
          logs.push({ barcode, productName: item.name, action: 'created' });
        }
      } catch (e) {
        errors++;
        logs.push({ barcode: item.barcode || '', productName: item.name, action: 'error', reason: e.message });
      }
    }
    const duration = Date.now() - startTime;
    importRecord.status = errors > 0 && created === 0 ? 'failed' : errors > 0 ? 'partial' : 'completed';
    importRecord.summary.productsCreated = created;
    importRecord.summary.productsUpdated = updated;
    importRecord.summary.productsSkipped = skipped;
    importRecord.summary.errors = errors;
    importRecord.importDuration = duration;
    importRecord.completedAt = new Date();
    await importRecord.save();
    if (logs.length > 0) {
      await BarcodeImportLog.insertMany(logs.map(l => ({ ...l, user: userId, business: req.businessId, importId: importRecord._id })));
    }
    res.json({ message: 'Bulk import completed', import: importRecord, summary: importRecord.summary, duration });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = getUserId(req);
    const { barcode, name, sku, category, brand, unit, salePrice, purchasePrice, mrp, gstRate, hsn, stock, minStock, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Product name is required' });
    let cleaned = '';
    if (barcode) {
      const validation = validateBarcode(barcode);
      if (!validation.valid) return res.status(400).json({ message: validation.error });
      cleaned = validation.cleaned;
      const existing = await Product.findOne({ ...baseFilter, barcode: cleaned });
      if (existing) return res.status(400).json({ message: 'A product with this barcode already exists', product: existing });
    }
    const newSku = sku || generateSKU(name, category, cleaned);
    const product = await Product.create({
      user: userId, business: req.businessId,
      name,
      barcode: cleaned,
      category: category || '',
      sku: newSku,
      price: salePrice ? parseFloat(salePrice) : 0,
      costPrice: purchasePrice ? parseFloat(purchasePrice) : 0,
      mrp: mrp ? parseFloat(mrp) : 0,
      stock: stock !== undefined ? parseFloat(stock) : 0,
      unit: unit || 'pcs',
      gstRate: gstRate !== undefined ? parseFloat(gstRate) : 0,
      minStock: minStock !== undefined ? parseFloat(minStock) : 5,
      hsn: hsn || '',
      brand: brand || '',
      description: description || '',
    });
    await BarcodeScanHistory.create({
      user: userId, business: req.businessId,
      barcode: cleaned,
      method: 'manual',
      product: product._id,
      productFound: false,
      action: 'created',
    });
    res.status(201).json({ message: 'Product created', product });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { id } = req.params;
    const updates = req.body;
    const product = await Product.findOne({ _id: id, ...baseFilter });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (updates.barcode) {
      const validation = validateBarcode(updates.barcode);
      if (!validation.valid) return res.status(400).json({ message: validation.error });
      updates.barcode = validation.cleaned;
      const dup = await Product.findOne({ ...baseFilter, barcode: validation.cleaned, _id: { $ne: id } });
      if (dup) return res.status(400).json({ message: 'Another product already has this barcode' });
    }
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.sku !== undefined) updateData.sku = updates.sku;
    if (updates.salePrice !== undefined) updateData.price = parseFloat(updates.salePrice);
    if (updates.purchasePrice !== undefined) updateData.costPrice = parseFloat(updates.purchasePrice);
    if (updates.mrp !== undefined) updateData.mrp = parseFloat(updates.mrp);
    if (updates.stock !== undefined) updateData.stock = parseFloat(updates.stock);
    if (updates.unit !== undefined) updateData.unit = updates.unit;
    if (updates.gstRate !== undefined) updateData.gstRate = parseFloat(updates.gstRate);
    if (updates.minStock !== undefined) updateData.minStock = parseFloat(updates.minStock);
    if (updates.hsn !== undefined) updateData.hsn = updates.hsn;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.description !== undefined) updateData.description = updates.description;
    const updated = await Product.findOneAndUpdate({ _id: id, ...baseFilter }, updateData, { new: true });
    res.json({ message: 'Product updated', product: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 20, search, method, status } = req.query;
    const query = { ...baseFilter };
    if (method) query.method = method;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fileName: { $regex: search, $options: 'i' } },
        { method: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await BarcodeImport.countDocuments(query);
    const imports = await BarcodeImport.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();
    res.json({ imports, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getHistoryById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const importRecord = await BarcodeImport.findOne({ _id: req.params.id, ...baseFilter }).lean();
    if (!importRecord) return res.status(404).json({ message: 'Import record not found' });
    const logs = await BarcodeImportLog.find({ importId: importRecord._id }).sort({ rowNumber: 1 }).lean();
    res.json({ import: importRecord, logs });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteImport = async (req, res) => {
  try {
    const userId = getUserId(req);
    const importRecord = await BarcodeImport.findOneAndDelete({ _id: req.params.id, user: userId });
    if (!importRecord) return res.status(404).json({ message: 'Import record not found' });
    await BarcodeImportLog.deleteMany({ importId: importRecord._id });
    res.json({ message: 'Import record deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getScanHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { page = 1, limit = 20, barcode, productId } = req.query;
    const query = { user: userId };
    if (barcode) query.barcode = { $regex: barcode, $options: 'i' };
    if (productId) query.product = productId;
    const total = await BarcodeScanHistory.countDocuments(query);
    const scans = await BarcodeScanHistory.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('product', 'name barcode price stock')
      .lean();
    res.json({ scans, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [totalImports, totalCreated, totalUpdated, lastImport] = await Promise.all([
      BarcodeImport.countDocuments({ user: userId }),
      BarcodeImport.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, created: { $sum: '$summary.productsCreated' }, updated: { $sum: '$summary.productsUpdated' } } },
      ]),
      BarcodeImport.findOne({ user: userId, status: 'completed' }).sort({ createdAt: -1 }).select('createdAt').lean(),
    ]);
    const stats = {
      totalImports,
      productsCreated: totalCreated[0]?.created || 0,
      productsUpdated: totalUpdated[0]?.updated || 0,
      lastImportDate: lastImport?.createdAt || null,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  scanBarcode,
  lookupBarcode,
  uploadBarcodeImage,
  previewCSV,
  executeCSV,
  bulkImport,
  createProduct,
  updateProduct,
  getHistory,
  getHistoryById,
  deleteImport,
  getScanHistory,
  getDashboardStats,
};
