const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_COOKIE = 'vyapar-csrf';

// HMAC-signed double-submit token. The cookie/header value is `<nonce>.<sig>` where
// sig = HMAC-SHA256(nonce + ':' + uid) keyed by JWT_SECRET. Signing makes the token
// unforgeable (an attacker can't craft a matching cookie/header pair without the secret),
// and binding the signature to the authenticated user id ties it to the session.
//
// Tokens are minted at GET /auth/csrf-token, which is reachable BEFORE login (uid = ''),
// so validation accepts a signature bound to either the empty uid (anonymous bootstrap
// token) or the current authenticated uid. This keeps the existing client flow working:
// the client fetches a token before login and may still be using it during the brief
// window before the post-login re-fetch lands.
const getSecret = () => {
  // JWT_SECRET is required at startup (see middleware/auth.js), so it is always present.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set; cannot sign CSRF tokens');
  }
  return process.env.JWT_SECRET;
};

const sign = (nonce, uid = '') =>
  crypto.createHmac('sha256', getSecret()).update(`${nonce}:${uid}`).digest('hex');

// Issue a fresh signed token bound to the given user id ('' when unauthenticated).
const generateCsrfToken = (uid = '') => {
  const nonce = crypto.randomBytes(32).toString('hex');
  return `${nonce}.${sign(nonce, uid)}`;
};

// Constant-time string comparison that is safe against length leaks.
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// Verify the token's signature against the accepted user ids (anonymous + current).
const hasValidSignature = (token, uid) => {
  if (typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const nonce = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  // Accept a token signed for an anonymous bootstrap ('') or for the current user.
  const candidates = uid ? ['', String(uid)] : [''];
  return candidates.some((candidate) => safeEqual(sig, sign(nonce, candidate)));
};

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // CSRF only protects COOKIE-based browser auth (the browser auto-sends the auth cookie
  // cross-site). A non-browser API client that authenticates with an explicit
  // `Authorization: Bearer <token>` header is NOT vulnerable to CSRF — an attacker site
  // can't make the victim's browser attach that header. So requests authenticated purely
  // via a Bearer token (e.g. the desktop sync client talking to the cloud API) are exempt.
  // Browser/cookie requests are unaffected and still fully CSRF-protected below.
  const authHeader = req.headers.authorization || '';
  const hasBearer = authHeader.startsWith('Bearer ');
  const hasAuthCookie = Boolean(req.cookies && req.cookies.token);
  if (hasBearer && !hasAuthCookie) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  const uid = req.user && req.user._id ? req.user._id.toString() : '';

  // Double-submit: header must match the cookie (constant-time), and the value must carry
  // a valid HMAC signature so it can't be forged without JWT_SECRET.
  if (
    !cookieToken ||
    !headerToken ||
    !safeEqual(cookieToken, headerToken) ||
    !hasValidSignature(headerToken, uid)
  ) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
};

module.exports = { csrfProtection, generateCsrfToken, CSRF_COOKIE };
