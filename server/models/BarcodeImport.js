const mongoose = require('mongoose');

const barcodeImportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: {
    type: String,
    enum: ['live_scanner', 'usb_scanner', 'camera', 'image', 'csv', 'bulk_sheet', 'database_lookup'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'previewing', 'importing', 'completed', 'failed', 'partial'],
    default: 'pending',
  },
  summary: {
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateBarcodes: { type: Number, default: 0 },
    newProducts: { type: Number, default: 0 },
    existingProducts: { type: Number, default: 0 },
    productsCreated: { type: Number, default: 0 },
    productsUpdated: { type: Number, default: 0 },
    productsSkipped: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
  },
  options: {
    createNew: { type: Boolean, default: true },
    updateExisting: { type: Boolean, default: true },
    updatePrices: { type: Boolean, default: false },
    updateStock: { type: Boolean, default: false },
    updateGST: { type: Boolean, default: false },
    skipDuplicates: { type: Boolean, default: false },
    overwriteExisting: { type: Boolean, default: false },
  },
  stockUpdateMode: {
    type: String,
    enum: ['add', 'replace', 'adjust', 'set_exact'],
    default: 'add',
  },
  priceUpdateMode: {
    type: String,
    enum: ['sale_price', 'purchase_price', 'mrp'],
    default: 'sale_price',
  },
  duplicateHandling: {
    type: String,
    enum: ['skip', 'update', 'merge', 'replace'],
    default: 'update',
  },
  fileName: { type: String },
  fileSize: { type: Number },
  importDuration: { type: Number },
  completedAt: { type: Date },
  errorLog: [{ type: String }],
}, { timestamps: true });

barcodeImportSchema.index({ user: 1, createdAt: -1 });
barcodeImportSchema.index({ user: 1, method: 1 });

module.exports = mongoose.model('BarcodeImport', barcodeImportSchema);
