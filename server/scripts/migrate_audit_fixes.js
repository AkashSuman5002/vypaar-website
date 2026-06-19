/* One-off migration for the audit fixes:
 *  1) Backfill User.isOwner=true for every Business owner.
 *  2) Renumber duplicate Purchase.billNumber / Expense.expenseNumber (per tenant)
 *     by appending a -DUP<n> suffix to the newer duplicates (never deletes), so the
 *     per-tenant unique number indexes can build.
 *  3) Build the Purchase + Expense unique number indexes.
 * Run once:  node scripts/migrate_audit_fixes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Business = require('../models/Business');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');

async function backfillOwners() {
  const businesses = await Business.find({ owner: { $ne: null } }).select('owner').lean();
  const ownerIds = [...new Set(businesses.map(b => String(b.owner)))];
  const r = await User.updateMany({ _id: { $in: ownerIds }, isOwner: { $ne: true } }, { $set: { isOwner: true } });
  console.log(`isOwner backfill: ${r.modifiedCount} owner user(s) updated (of ${ownerIds.length} business owners)`);
}

async function dedupeNumbers(Model, field, label) {
  // Group non-empty values per (user,business,field); flag groups with >1 doc.
  const groups = await Model.aggregate([
    { $match: { [field]: { $type: 'string', $ne: '' } } },
    { $group: { _id: { user: '$user', business: '$business', num: `$${field}` }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  let renamed = 0;
  for (const g of groups) {
    // Keep the first (oldest by _id), renumber the rest with a unique suffix.
    const ids = g.ids.sort((a, b) => String(a).localeCompare(String(b)));
    for (let i = 1; i < ids.length; i++) {
      const newVal = `${g._id.num}-DUP${i}`;
      await Model.updateOne({ _id: ids[i] }, { $set: { [field]: newVal } });
      renamed++;
      console.log(`  ${label}: renumbered duplicate "${g._id.num}" -> "${newVal}"`);
    }
  }
  console.log(`${label}: ${groups.length} duplicate group(s), ${renamed} doc(s) renumbered`);
}

(async () => {
  await connectDB();
  await backfillOwners();
  await dedupeNumbers(Purchase, 'billNumber', 'Purchase.billNumber');
  await dedupeNumbers(Expense, 'expenseNumber', 'Expense.expenseNumber');
  // Build the now-buildable unique indexes.
  for (const M of [Purchase, Expense]) {
    try { await M.createIndexes(); console.log(`indexes built: ${M.modelName}`); }
    catch (e) { console.log(`index build still blocked for ${M.modelName}: ${e.message}`); }
  }
  await mongoose.disconnect();
  console.log('Migration complete.');
  process.exit(0);
})().catch(async (e) => { console.error('MIGRATION ERROR:', e); try { await mongoose.disconnect(); } catch {} process.exit(1); });
