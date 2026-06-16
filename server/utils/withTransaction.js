const mongoose = require('mongoose');
const { areTransactionsSupported } = require('../config/db');

/**
 * Run a unit of work atomically when the database supports transactions
 * (replica set / Atlas / mongos), and inline (non-atomic) otherwise.
 *
 * Usage in a controller:
 *
 *   await withTransaction(async (session) => {
 *     await Product.bulkWrite(ops, { session });
 *     await StockMovement.insertMany(moves, { session });
 *     await sale.save({ session });
 *     await Customer.findByIdAndUpdate(id, upd, { session });
 *   });
 *
 * Every write inside the callback MUST forward the `session` it receives.
 * When transactions are unsupported, `session` is `null` and the same writes
 * run without a session — identical to the previous (pre-transaction) behaviour,
 * so this is safe to adopt on a standalone dev server.
 *
 * The callback may be invoked more than once if MongoDB reports a transient
 * transaction error, so it must not perform external side effects (emails,
 * notifications, push) — do those AFTER withTransaction resolves.
 *
 * @param {(session: import('mongoose').ClientSession | null) => Promise<any>} fn
 * @returns {Promise<any>} the callback's return value
 */
async function withTransaction(fn) {
  if (!areTransactionsSupported()) {
    // Standalone server: run inline, exactly as before. No session, no retry.
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
