const mongoose = require('mongoose');

// Short-lived one-time passcodes for account verification (registration) and
// passwordless login. Documents auto-delete at `expiresAt` via the TTL index.
const otpSchema = new mongoose.Schema({
  // Normalized email (lowercased) OR phone, used to look the OTP up.
  identifier: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['register', 'login'], required: true },
  codeHash: { type: String, required: true },
  // Pending registration data ({ name, email, phone }) — only set for purpose 'register'.
  payload: { type: mongoose.Schema.Types.Mixed },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

otpSchema.index({ identifier: 1, purpose: 1 });
// TTL: MongoDB removes the doc once `expiresAt` passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
