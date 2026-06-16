const mongoose = require('mongoose');

// Whether the connected MongoDB deployment supports multi-document transactions
// (i.e. it is a replica set or mongos). Standalone servers do not. This is read by
// utils/withTransaction.js so the same code path runs atomically in production
// (replica set / Atlas) and degrades gracefully on a standalone dev server.
let transactionsSupported = false;
const areTransactionsSupported = () => transactionsSupported;

const detectTransactionSupport = async () => {
  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 });
    // `setName` is present only on replica-set members; `msg === 'isdbgrid'` on mongos.
    transactionsSupported = Boolean(info.setName) || info.msg === 'isdbgrid';
    console.log(
      transactionsSupported
        ? `MongoDB transactions: ENABLED (replica set: ${info.setName || 'mongos'})`
        : 'MongoDB transactions: DISABLED (standalone server — multi-write flows are NOT atomic; convert to a replica set for atomicity)'
    );
  } catch (err) {
    transactionsSupported = false;
    console.warn('Could not detect MongoDB transaction support:', err.message);
  }
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set. Refusing to start.');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await detectTransactionSupport();
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }

  // Don't silently die on a mid-run disconnect; log and let the driver auto-reconnect.
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — driver will attempt to reconnect.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));
};

module.exports = connectDB;
module.exports.areTransactionsSupported = areTransactionsSupported;
