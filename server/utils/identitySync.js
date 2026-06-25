// ---------------------------------------------------------------------------
// Identity / config sync — the part the per-tenant DATA sync left out.
//
// TENANT_MODELS (backupService) syncs business DATA (sales, parties, items…).
// It deliberately excluded the IDENTITY models, so these never travelled between
// a user's devices:
//   - User      (staff logins created in User Management)
//   - Role      (custom roles & permissions)
//   - Branch    (branches)
//   - Setting   (per-user preferences / invoice config)
//   - Business  (the business profile: name, address, GSTIN…)
//
// This module adds them to the cloud sync with PROPER per-model scoping (each one
// is keyed differently), so:
//   * a staff login created on any PC appears — and can log in — on every PC,
//   * settings / business-profile / role edits propagate continuously.
//
// SCOPING (tenant isolation is still enforced server-side):
//   users/roles/branches -> { business: businessId }   (business FORCED on push)
//   settings             -> { user: <this business's users> }
//   business             -> { _id: businessId }         (only the caller's own doc)
//
// Conflict resolution is the same last-write-wins on updatedAt used everywhere
// else (applied on the receiving side), and updatedAt is preserved on write
// (timestamps:false) so synced docs converge instead of echoing.
//
// KNOWN LIMITATION (MVP): syncing User docs means a device pushes ALL of the
// business's users (owner + staff) under last-write-wins. In the intended
// single-owner + trusted-staff setup this is fine; a hostile staff device could
// in theory overwrite another user's record. Hardening (per-user authorship /
// role-gating which users a device may write) is a documented follow-up.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

// sync key -> Mongoose model name
const IDENTITY_MODELS = {
  users: 'User',
  roles: 'Role',
  branches: 'Branch',
  settings: 'Setting',
  business: 'Business',
};

const model = (name) => { try { return mongoose.model(name); } catch (_) { return null; } };

// Largest updatedAt across an identity payload — used to advance the sync cursor
// so unchanged identity docs aren't re-fetched/re-sent every pass.
function maxIdentityTs(payload = {}) {
  let m = 0;
  for (const key of Object.keys(IDENTITY_MODELS)) {
    for (const d of payload[key] || []) {
      const t = d && d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
      if (t > m) m = t;
    }
  }
  return m;
}

// Resolve the user ids that belong to a business (settings are keyed per user).
async function userIdsForBusiness(businessId) {
  const User = model('User');
  if (!User) return [];
  const users = await User.find({ business: businessId }).select('_id').lean();
  return users.map((u) => u._id);
}

// --- read this business's identity docs changed after `since` (CLOUD pull, or
// the desktop collecting its own local changes to push). -------------------
async function collectIdentity(businessId, since) {
  const out = { users: [], roles: [], branches: [], settings: [], business: [] };
  if (!businessId) return out;
  const sinceF = since ? { updatedAt: { $gt: new Date(since) } } : {};

  const User = model('User');
  if (User) out.users = await User.find({ business: businessId, ...sinceF }).lean();

  const Role = model('Role');
  if (Role) out.roles = await Role.find({ business: businessId, ...sinceF }).lean();

  const Branch = model('Branch');
  if (Branch) out.branches = await Branch.find({ business: businessId, ...sinceF }).lean();

  const Setting = model('Setting');
  if (Setting) {
    const ids = await userIdsForBusiness(businessId);
    if (ids.length) out.settings = await Setting.find({ user: { $in: ids }, ...sinceF }).lean();
  }

  const Business = model('Business');
  if (Business) out.business = await Business.find({ _id: businessId, ...sinceF }).lean();

  return out;
}

// --- upsert incoming identity docs, scoped to this business (CLOUD push). ----
// business is FORCED on users/roles/branches so a client can only write into its
// own tenant; the business profile is matched by _id (own doc only). Returns a
// per-key applied count. updatedAt is preserved (timestamps:false) for LWW.
async function pushIdentity(businessId, incoming = {}) {
  const applied = {};
  const upsertAll = async (key, modelName, { forceBusiness = false, onlyOwnId = false } = {}) => {
    const docs = Array.isArray(incoming[key]) ? incoming[key] : [];
    const M = model(modelName);
    if (!M || !docs.length) { applied[key] = 0; return; }
    let n = 0;
    for (const raw of docs) {
      const id = raw && raw._id;
      if (!id) continue;
      if (onlyOwnId && String(id) !== String(businessId)) continue;
      const clean = { ...raw };
      delete clean._id;
      delete clean.__v;
      if (forceBusiness) clean.business = businessId;
      try {
        await M.replaceOne({ _id: id }, clean, { upsert: true, timestamps: false });
        n++;
      } catch (_) { /* skip a conflicting doc (e.g. a unique-index clash) */ }
    }
    applied[key] = n;
  };

  await upsertAll('users', 'User', { forceBusiness: true });
  await upsertAll('roles', 'Role', { forceBusiness: true });
  await upsertAll('branches', 'Branch', { forceBusiness: true });
  await upsertAll('settings', 'Setting'); // keyed by user, no business field to force
  await upsertAll('business', 'Business', { onlyOwnId: true });
  return applied;
}

module.exports = { IDENTITY_MODELS, collectIdentity, pushIdentity, maxIdentityTs };
