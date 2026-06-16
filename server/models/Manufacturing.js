const mongoose = require('mongoose');

const bomItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },
  costPerUnit: { type: Number, default: 0, min: 0 },
  totalCost: { type: Number, default: 0, min: 0 },
}, { _id: true });

const manufacturingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  orderNumber: { type: String, required: true, trim: true },
  status: { type: String, enum: ['planned', 'in_progress', 'completed', 'cancelled'], default: 'planned', index: true },
  date: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date },

  finishedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  finishedProductName: { type: String, trim: true },
  plannedQuantity: { type: Number, required: true, min: 1 },
  producedQuantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },

  bomItems: [bomItemSchema],
  totalBomCost: { type: Number, default: 0, min: 0 },
  labourCost: { type: Number, default: 0, min: 0 },
  overheadCost: { type: Number, default: 0, min: 0 },
  totalCost: { type: Number, default: 0, min: 0 },
  costPerUnit: { type: Number, default: 0, min: 0 },

  notes: { type: String, trim: true },
  completedDate: { type: Date },
  createdBy: { type: String, trim: true },
  updatedBy: { type: String, trim: true },
}, { timestamps: true });

manufacturingSchema.index({ user: 1, orderNumber: 1 }, { unique: true, sparse: true });
manufacturingSchema.index({ user: 1, status: 1 });
manufacturingSchema.index({ user: 1, date: -1 });
manufacturingSchema.index({ user: 1, finishedProduct: 1 });

module.exports = mongoose.model('Manufacturing', manufacturingSchema);
