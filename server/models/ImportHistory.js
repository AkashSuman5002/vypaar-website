const mongoose = require('mongoose');

const importHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  importType: { type: String, enum: ['excel', 'vyapar_backup', 'barcode'], required: true },
  status: { type: String, enum: ['in_progress', 'completed', 'failed', 'partial'], default: 'in_progress' },
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
  failedRecords: { type: Number, default: 0 },
  errorLog: [{ type: String }],
  duplicateHandling: { type: String, enum: ['skip', 'update', 'create'], default: 'skip' },
  fileName: { type: String },
  fileSize: { type: Number },
  uploadPath: { type: String },
  vyaparVersion: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('ImportHistory', importHistorySchema);
