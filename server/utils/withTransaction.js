const mongoose = require('mongoose');
const { areTransactionsSupported } = require('../config/db');

/**
 * Run a unit of work atomically when the database supports transactions
 * (replica set / Atlas / mongos).
 *
 * Usage in a controller (unchanged):
 *
 *   await withTransaction(async (session) => {
 *     await Product.bulkWrite(ops, { session });
 *     await StockMovement.insertMany(moves, { session });
 *     await sale.save({ session });
 *     await Customer.findByIdAndUpdate(id, upd, { session });
 *   });
 *
 * Every write inside the callback MUST forward the `session` it receives.
 *
 * Behaviour matrix:
 *
 *   - Replica set / mongos (transactions supported):
 *       Runs inside a real session + transaction. Mongoose's
 *       `session.withTransaction` automatically retries the whole callback on
 *       TransientTransactionError and re-commits on UnknownTransactionCommitResult,
 *       so the callback may run more than once.
 *
 *   - Standalone mongod (transactions NOT supported), default:
 *       FAILS FAST. Throws a clear error instead of silently running non-atomic
 *       writes that could corrupt data on a partial failure (e.g. stock updated
 *       but ledger not written). Set ALLOW_NON_TRANSACTIONAL=true to opt in to
 *       best-effort inline execution (see below).
 *
 *   - Standalone mongod with ALLOW_NON_TRANSACTIONAL=true (local dev opt-in):
 *       Runs the callback inline with `session === null` and NO atomicity and NO
 *       retry. A one-time loud warning is logged. This is the old behaviour,
 *       now explicitly opt-in so it can never happen silently in production.
 *
 * Because the callback may be invoked more than once (transient retries), it
 * must not perform external side effects (emails, notifications, push) — do
 * those AFTER withTransaction resolves.
 *
 * @param {(session: import('mongoose').ClientSession | null) => Promise<any>} fn
 * @returns {Promise<any>} the callback's return value
 */

// Opt-in escape hatch for local/dev environments running a standalone mongod.
// Treated as enabled only for the explicit string 'true' (case-insensitive) to
// avoid accidental activation from stray values.
function isNonTransactionalAllowed() {
  return String(process.env.ALLOW_NON_TRANSACTIONAL || '')
    .trim()
    .toLowerCase() === 'true';
}

// Ensure the loud standalone warning is emitted at most once per process so the
// logs are not flooded on every write, while still being impossible to miss.
let standaloneWarningLogged = false;
function warnNonTransactionalOnce() {
  if (standaloneWarningLogged) return;
  standaloneWarningLogged = true;
  console.warn(
    '\n' +
      '============================================================\n' +
      '  WARNING: MongoDB is NOT a replica set.\n' +
      '  Multi-document operations are running WITHOUT transactions\n' +
      '  and are therefore NOT ATOMIC. A partial failure can leave\n' +
      '  data inconsistent (e.g. stock updated but ledger not written).\n' +
      '\n' +
      '  This is running only because ALLOW_NON_TRANSACTIONAL=true.\n' +
      '  DO NOT use this mode in production.\n' +
      '\n' +
      '  To enable atomic transactions, run this deployment as a\n' +
      '  replica set, e.g.:\n' +
      "    - start mongod with --replSet rs0, then run rs.initiate()\n" +
      '    - or use MongoDB Atlas (replica set by default)\n' +
      '============================================================\n'
  );
}

// Error thrown when transactions are unsupported and the opt-in flag is unset.
// Fails fast and visibly so the operation aborts before writing partial data.
function buildNonTransactionalError() {
  const err = new Error(
    'Atomic operation aborted: this MongoDB deployment is a standalone server ' +
      'and does not support transactions, so multi-document writes cannot be ' +
      'performed atomically. Convert the deployment to a replica set (mongod ' +
      '--replSet rs0 + rs.initiate(), or use MongoDB Atlas) to enable ' +
      'transactions. For local development only, set ALLOW_NON_TRANSACTIONAL=true ' +
      'to run non-atomically at your own risk.'
  );
  err.code = 'TRANSACTIONS_UNSUPPORTED';
  err.statusCode = 500;
  return err;
}

async function withTransaction(fn) {
  if (!areTransactionsSupported()) {
    // Transactions are unavailable (standalone mongod). Do NOT silently pretend
    // the work is atomic.
    if (!isNonTransactionalAllowed()) {
      // Default: fail fast and visibly rather than risk silent corruption.
      throw buildNonTransactionalError();
    }
    // Explicit opt-in: best-effort inline execution. Loud one-time warning, then
    // run with no session, no atomicity, no retry (preserves the legacy contract:
    // `session` is null and the same writes run without a session).
    warnNonTransactionalOnce();
    return fn(null);
  }

  // Transactions supported: run inside a real session + transaction with the
  // driver's built-in retry on TransientTransactionError /
  // UnknownTransactionCommitResult.
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
