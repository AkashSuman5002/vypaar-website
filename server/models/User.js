const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: {
    type: String, required: true, minlength: 8,
    validate: {
      validator: (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v),
      message: 'Password must contain at least 8 characters with uppercase, lowercase, and a number',
    },
  },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'user', 'Admin', 'Manager', 'Accountant', 'Staff'], default: 'admin' },
  permissions: [{ type: String }],
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  isOwner: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
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
