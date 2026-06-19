const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Password is optional now that accounts can be created/used via passwordless OTP login.
  password: {
    type: String, minlength: 8,
    validate: {
      validator: (v) => !v || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v),
      message: 'Password must contain at least 8 characters with uppercase, lowercase, and a number',
    },
  },
  phone: { type: String, default: '', trim: true, index: true },
  isVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'user', 'Admin', 'Manager', 'Accountant', 'Staff'], default: 'admin' },
  permissions: [{ type: String }],
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  isOwner: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  // Bumping this invalidates all previously-issued JWTs for the user (token revocation).
  // Backward compatible: old tokens carry no `tv` claim (=> 0) and fresh users default to 0.
  tokenVersion: { type: Number, default: 0 },
  // Two-Factor Auth (TOTP/RFC-6238). Secret is base32 and `select: false` so it is
  // NEVER returned by a normal query/toJSON — it must be explicitly `.select('+twoFactorSecret')`.
  // twoFactorEnabled stays false (default) until the user verifies a code, so existing
  // users are completely unaffected and log in exactly as before.
  twoFactorSecret: { type: String, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  passwordResetToken: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
