const Counter = require('../models/Counter');

/**
 * Atomically allocate the next integer in a per-tenant document-number series.
 *
 * Eliminates the read-max-then-increment race: instead of `findOne().sort()` +1
 * (which two concurrent requests can both read as N and both write N+1), this
 * does a single atomic `$inc` on a Counter row. The CALLER formats the returned
 * integer (prefix / zero-padding) exactly as before.
 *
 * Seeding: the counter must not restart at 1 when higher numbers already exist
 * (e.g. data created before counters were introduced). On the FIRST increment
 * for a given counter (detected by the upserted seq === 1) we call the caller-
 * supplied `seedFn()` to get the current max numeric value among existing docs
 * for that tenant+key. If that max is >= 1 we bump the counter to max+1 with a
 * `$max` update and return it. Every subsequent call is a pure atomic increment.
 *
 * @param {{ user: any, business?: any }} scope  tenant scope
 * @param {string} key                           series key, e.g. 'sale_invoice'
 * @param {{ session?: any, seedFn?: () => Promise<number> }} [opts]
 * @returns {Promise<number>} the next integer in the series
 */
async function getNextSequence(scope, key, opts = {}) {
  const { session, seedFn } = opts;
  const user = scope.user;
  const business = scope.business || null;

  const filter = { user, business, key };

  const doc = await Counter.findOneAndUpdate(
    filter,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  // First-ever allocation for this counter: seed from existing data so we never
  // hand out a number that already exists.
  if (doc.seq === 1 && typeof seedFn === 'function') {
    const maxExisting = Number(await seedFn()) || 0;
    if (maxExisting >= 1) {
      const seeded = await Counter.findOneAndUpdate(
        filter,
        { $max: { seq: maxExisting + 1 } },
        { new: true, session },
      );
      return seeded.seq;
    }
  }

  return doc.seq;
}

module.exports = { getNextSequence };
