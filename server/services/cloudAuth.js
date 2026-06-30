// ---------------------------------------------------------------------------
// Cloud-first authentication (DESKTOP side) — Option B.
//
// When CLOUD_API_URL is set, the account lives in the CLOUD. On login the desktop:
//   1. authenticates against the cloud,
//   2. fetches its identity bundle (/api/sync/bootstrap),
//   3. MIRRORS that identity into the LOCAL DB using the SAME _ids (so synced data
//      lines up) and stores a LOCAL password hash (so OFFLINE login works afterward),
//   4. hands the cloud token to the sync client.
// The local backend then issues its normal local session and the app runs against
// the local DB as usual; the sync client keeps local and cloud in step.
//
// Offline: if the cloud is unreachable, the caller falls back to local auth using
// the cached user + the local password hash written here on a previous online login.
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const client = require('./cloudSyncClient');

const api = () => (process.env.CLOUD_API_URL || '').replace(/\/+$/, '');
const isCloudMode = () => Boolean(api());

const stripMeta = (o) => { const x = { ...o }; delete x.__v; return x; };

const tokenFromSetCookie = (res) => {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of cookies) if (c.startsWith('token=')) return c.split(';')[0].slice('token='.length);
  return null;
};

const cloudFetch = async (path, opts = {}, token) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  // Generous timeout: a free-tier cloud instance can take ~50s to wake from idle (cold start).
  const res = await fetch(api() + path, { ...opts, headers, signal: AbortSignal.timeout(60000) });
  let data = null; try { data = await res.json(); } catch (_) {}
  return { res, data, status: res.status };
};

// Mirror the cloud identity bundle into the LOCAL DB with exact _ids.
const mirrorIdentity = async (bundle, plainPassword) => {
  const User = mongoose.model('User');
  const Business = mongoose.model('Business');
  const Setting = mongoose.model('Setting');
  const Branch = mongoose.model('Branch');
  const Role = mongoose.model('Role');
  const { user, business, setting, branches = [], roles = [] } = bundle;
  if (!user || !user._id) throw new Error('bootstrap returned no user');

  if (business && business._id) await Business.replaceOne({ _id: business._id }, stripMeta(business), { upsert: true });
  for (const b of branches) if (b && b._id) await Branch.replaceOne({ _id: b._id }, stripMeta(b), { upsert: true });
  for (const r of roles) if (r && r._id) await Role.replaceOne({ _id: r._id }, stripMeta(r), { upsert: true });
  if (setting && setting._id) await Setting.replaceOne({ _id: setting._id }, stripMeta(setting), { upsert: true });

  // User: mirror with exact _id + a LOCAL password hash so offline login works later.
  const hash = await bcrypt.hash(plainPassword, 12);
  // Preserve DEVICE-LOCAL 2FA. It's configured on this device and the cloud account does not
  // track it, so a blind replace would wipe twoFactorEnabled/Secret and silently skip 2FA at
  // login. Keep the local values when 2FA is enabled here so login still enforces it.
  const prior = await User.findById(user._id).select('+twoFactorSecret twoFactorEnabled').lean();
  const localUser = { ...stripMeta(user), password: hash, business: business ? business._id : user.business };
  if (prior && prior.twoFactorEnabled && prior.twoFactorSecret) {
    localUser.twoFactorEnabled = true;
    localUser.twoFactorSecret = prior.twoFactorSecret;
  }
  await User.replaceOne({ _id: user._id }, localUser, { upsert: true });

  // Return a fresh local copy (without password) for the session.
  return User.findById(user._id).select('-password').lean();
};

// Authenticate against the cloud and mirror identity locally. Throws on failure.
// On a network error the thrown error has `.network = true` so the caller can fall
// back to offline local auth. On bad credentials `.cloudAuthFail = true`.
const cloudLoginAndMirror = async (email, password) => {
  let login;
  try {
    login = await cloudFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  } catch (e) {
    const err = new Error('cloud unreachable: ' + e.message);
    err.network = true;
    throw err;
  }
  if (login.status !== 200) {
    const err = new Error(login.data?.message || `cloud login failed (${login.status})`);
    err.cloudAuthFail = login.status === 401 || login.status === 400;
    err.status = login.status;
    throw err;
  }
  // 2FA on the cloud account is not handled in this MVP path.
  if (login.data && login.data.twoFactorRequired) {
    const err = new Error('Two-factor login is not yet supported in cloud mode');
    err.cloudAuthFail = true;
    throw err;
  }
  const token = tokenFromSetCookie(login.res);
  if (!token) throw new Error('cloud login returned no token');

  const boot = await cloudFetch('/api/sync/bootstrap', {}, token);
  if (boot.status !== 200) throw new Error(`cloud bootstrap failed (${boot.status})`);

  const localUser = await mirrorIdentity(boot.data, password);
  client.setToken(token);
  return localUser;
};

// Register a new account on the cloud, then mirror + sign in locally.
const cloudRegisterAndMirror = async (name, email, password) => {
  let reg;
  try {
    reg = await cloudFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  } catch (e) {
    const err = new Error('cloud unreachable: ' + e.message);
    err.network = true;
    throw err;
  }
  if (reg.status !== 201) {
    const err = new Error(reg.data?.message || `cloud register failed (${reg.status})`);
    err.cloudAuthFail = true;
    err.status = reg.status;
    throw err;
  }
  // Account created on the cloud; now log in + mirror locally.
  return cloudLoginAndMirror(email, password);
};

// Ask the cloud to send a password-reset email for this address. Returns the cloud's
// (generic) response. Throws with .network=true if the cloud is unreachable.
const cloudForgotPassword = async (email) => {
  let r;
  try {
    r = await cloudFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  } catch (e) {
    const err = new Error('cloud unreachable: ' + e.message);
    err.network = true;
    throw err;
  }
  return r.data || { message: 'If that account exists, a reset link has been sent.' };
};

module.exports = { isCloudMode, cloudLoginAndMirror, cloudRegisterAndMirror, cloudForgotPassword };
