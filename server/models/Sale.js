const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, trim: true },
  description: { type: String, trim: true },
  hsn: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  freeQuantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'Pcs', trim: true },
  rate: { type: Number, required: true, min: 0 },
  mrp: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  taxableAmount: { type: Number, default: 0, min: 0 },
  cgst: { type: Number, default: 0, min: 0 },
  sgst: { type: Number, default: 0, min: 0 },
  igst: { type: Number, default: 0, min: 0 },
  cess: { type: Number, default: 0, min: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed', 'none'], default: 'none' },
  discountValue: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  batchNo: { type: String, trim: true },
  expiryDate: { type: Date },
  serialNo: { type: String, trim: true },
  isService: { type: Boolean, default: false },
}, { _id: true });

const salePaymentSchema = new mongoose.Schema({
  mode: { type: String, enum: ['cash', 'upi', 'bank', 'card', 'cheque', 'credit'], required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  transactionNo: { type: String, trim: true },
  bankName: { type: String, trim: true },
  chequeNo: { type: String, trim: true },
  referenceNo: { type: String, trim: true },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  branch: { type: String, trim: true },
  warehouse: { type: String, trim: true },

  invoiceNumber: { type: String, required: true, trim: true },
  type: { type: String, enum: ['invoice', 'quotation', 'order', 'challan', 'credit_note', 'return', 'estimate', 'proforma'], default: 'invoice', index: true },
  status: { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'confirmed', index: true },
  date: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date },
  referenceNumber: { type: String, trim: true },
  salesPerson: { type: String, trim: true },

  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  customerEmail: { type: String, trim: true },
  customerGst: { type: String, trim: true },
  customerType: { type: String, enum: ['retail', 'wholesale', 'dealer', 'walk-in'], default: 'retail' },
  customerState: { type: String, trim: true },
  billingAddress: { type: String, trim: true },
  shippingAddress: { type: String, trim: true },
  placeOfSupply: { type: String, trim: true },
  isInterState: { type: Boolean, default: false },
  reverseCharge: { type: Boolean, default: false },

  items: [saleItemSchema],
  totalItems: { type: Number, default: 0 },
  totalQuantity: { type: Number, default: 0 },

  taxableAmount: { type: Number, default: 0, min: 0 },
  discountTotal: { type: Number, default: 0, min: 0 },
  cgstTotal: { type: Number, default: 0, min: 0 },
  sgstTotal: { type: Number, default: 0, min: 0 },
  igstTotal: { type: Number, default: 0, min: 0 },
  cessTotal: { type: Number, default: 0, min: 0 },
  taxTotal: { type: Number, default: 0, min: 0 },

  shippingCharge: { type: Number, default: 0, min: 0 },
  packingCharge: { type: Number, default: 0, min: 0 },
  freightCharge: { type: Number, default: 0, min: 0 },
  loadingCharge: { type: Number, default: 0, min: 0 },
  otherCharge: { type: Number, default: 0, min: 0 },
  additionalChargesTotal: { type: Number, default: 0, min: 0 },

  discountOnInvoice: { type: Number, default: 0, min: 0 },

  roundOff: { type: Number, default: 0 },
  roundOffEnabled: { type: Boolean, default: false },
  roundingMethod: { type: String, enum: ['Normal', 'Up', 'Down'], default: 'Normal' },

  totalAmount: { type: Number, required: true, min: 0 },

  payments: [salePaymentSchema],
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingBalance: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid', index: true },

  eWayBill: { type: String, trim: true },
  transportMode: { type: String, trim: true },
  vehicleNo: { type: String, trim: true },
  poNumber: { type: String, trim: true },

  notes: { type: String, trim: true },
  internalNotes: { type: String, trim: true },
  termsConditions: { type: String, trim: true },
  attachments: [{ name: String, url: String }],

  deliveryStatus: { type: String, enum: ['pending', 'delivered', 'cancelled'], default: 'pending' },
  parentSale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },

  // Recurring invoice support
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
  recurringNextDate: { type: Date },
  recurringEndDate: { type: Date },
  recurringCount: { type: Number, default: 0 },
  recurringMaxCount: { type: Number, default: 0 },
  isRecurringTemplate: { type: Boolean, default: false },

  createdBy: { type: String, trim: true },
  updatedBy: { type: String, trim: true },
}, { timestamps: true });

saleSchema.index({ user: 1, business: 1, invoiceNumber: 1 }, { unique: true, sparse: true });
saleSchema.index({ user: 1, date: -1 });
saleSchema.index({ user: 1, customer: 1 });
saleSchema.index({ user: 1, paymentStatus: 1 });
saleSchema.index({ user: 1, type: 1, date: -1 });
saleSchema.index({ user: 1, status: 1 });
saleSchema.index({ user: 1, 'items.product': 1 });

module.exports = mongoose.model('Sale', saleSchema);
