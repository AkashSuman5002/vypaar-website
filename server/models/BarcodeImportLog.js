const mongoose = require('mongoose');

const barcodeImportLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarcodeImport', required: true, index: true },
  rowNumber: { type: Number },
  barcode: { type: String, trim: true },
  productName: { type: String, trim: true },
  action: {
    type: String,
    enum: ['created', 'updated', 'skipped', 'error', 'warning', 'merged', 'replaced'],
    required: true,
  },
  reason: { type: String },
  message: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

barcodeImportLogSchema.index({ importId: 1 });
barcodeImportLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('BarcodeImportLog', barcodeImportLogSchema);
