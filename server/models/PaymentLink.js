const mongoose = require('mongoose');

// A payment-collection link created for an invoice (Razorpay Payment Links). Tracks the
// provider link id + short URL and its status, so we can show "Pay Now", reconcile payment,
// and avoid creating duplicate links for the same invoice.
const paymentLinkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', index: true },
  provider: { type: String, default: 'razorpay' },
  providerLinkId: { type: String, index: true },
  shortUrl: { type: String, default: '' },
  amount: { type: Number, default: 0 }, // rupees
  status: { type: String, enum: ['created', 'paid', 'partially_paid', 'cancelled', 'expired', 'refunded'], default: 'created', index: true },
  paidAt: { type: Date },
  reconciled: { type: Boolean, default: false }, // invoice marked paid + payment recorded
  providerPaymentId: { type: String, default: '' }, // razorpay pay_xxx (needed for refunds)
  refundId: { type: String, default: '' },
  refundedAmount: { type: Number, default: 0 }, // rupees
  refundedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PaymentLink', paymentLinkSchema);
