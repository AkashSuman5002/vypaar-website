const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exportType: { type: String, enum: ['excel', 'backup', 'report'], required: true },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  summary: {
    customers: { type: Number, default: 0 },
    suppliers: { type: Number, default: 0 },
    products: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    stockMovements: { type: Number, default: 0 },
    payments: { type: Number, default: 0 },
    gstRecords: { type: Number, default: 0 },
  },
  fileName: { type: String },
  fileSize: { type: Number },
  filePath: { type: String },
  format: { type: String, enum: ['xlsx', 'csv', 'zip', 'pdf'], default: 'xlsx' },
  filters: { type: mongoose.Schema.Types.Mixed },
  modules: [{ type: String }],
  completedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('ExportHistory', exportHistorySchema);
