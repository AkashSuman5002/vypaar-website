const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'new_sale', 'new_purchase', 'payment_received', 'payment_due',
      'low_stock', 'purchase_return', 'sale_return', 'expense_created',
      'service_reminder', 'party_added', 'bank_transaction',
      'sale_cancelled', 'purchase_cancelled', 'sale_updated',
      // Previously emitted by controllers but missing from the enum, which made
      // Mongoose silently reject (throw) these notifications. Now accepted.
      'purchase_updated', 'purchase_deleted',
      'expense_updated', 'expense_deleted',
      'payment_out', 'payment_out_deleted',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceModel: { type: String },
  read: { type: Boolean, default: false, index: true },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
