const mongoose = require('mongoose');

const barcodeScanHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  barcode: { type: String, required: true, trim: true },
  format: {
    type: String,
    enum: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code128', 'Code39', 'QR_CODE', 'unknown'],
    default: 'unknown',
  },
  method: {
    type: String,
    enum: ['live_scanner', 'usb_scanner', 'camera', 'image', 'manual'],
    default: 'camera',
  },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productFound: { type: Boolean, default: false },
  action: {
    type: String,
    enum: ['viewed', 'created', 'updated', 'ignored'],
    default: 'viewed',
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
  source: { type: String, trim: true },
}, { timestamps: true });

barcodeScanHistorySchema.index({ user: 1, createdAt: -1 });
barcodeScanHistorySchema.index({ user: 1, barcode: 1 });
barcodeScanHistorySchema.index({ barcode: 1 });

module.exports = mongoose.model('BarcodeScanHistory', barcodeScanHistorySchema);
