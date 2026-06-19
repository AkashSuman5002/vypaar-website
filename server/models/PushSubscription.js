const mongoose = require('mongoose');

// Persistent storage for Web Push subscriptions. Previously these lived in an
// in-memory Map in pushNotificationService, which was lost on every restart.
const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, default: '' },
    auth: { type: String, default: '' },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
