const jwt = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    // Prefer the httpOnly `token` cookie (hardening #28): a cookie can't be read by JS, so it
    // is not exposed to XSS the way a localStorage Bearer token is. We then FALL BACK to the
    // Authorization: Bearer header so nothing breaks for the current cross-origin dev setup.
    //
    // NOTE: We intentionally keep BOTH transports. Fully eliminating the body/localStorage
    // token (cookie-only auth) is NOT done here because the client (:3000) and API (:5000) are
    // different origins over http in dev, where a SameSite cookie isn't reliably sent on XHR.
    // Going cookie-only requires migrating to a same-origin setup (CRA `proxy` + a relative API
    // base URL); that migration also affects the SSE / uploads / push `?token=` query-param auth
    // paths and must be tested live, so it is deliberately deferred.
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // EventSource (SSE) cannot set an Authorization header, so for those requests
    // accept the token from the query string. Gated on the SSE Accept header so this
    // fallback is not available to ordinary API requests.
    if (!token && req.query && req.query.token &&
        typeof req.headers.accept === 'string' && req.headers.accept.includes('text/event-stream')) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    // Token revocation: a token whose version no longer matches the user's current
    // tokenVersion has been invalidated (e.g. by a password reset / logout-all).
    // Backward compatible: legacy tokens lack `tv` (=> 0) and default users are 0.
    if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const sseAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    // Same-origin (CRA proxy) cookie auth: EventSource sends the httpOnly `token` cookie
    // automatically now that /api is same-origin, so prefer it before any header/query fallback.
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // EventSource cannot set an Authorization header, so the token may arrive as a
    // query-string param. RESIDUAL RISK: a JWT in the query string can leak into
    // access logs / proxy logs / browser history. To minimise that exposure, only
    // accept the query token for genuine SSE requests — i.e. those that advertise
    // the SSE Accept header (text/event-stream), exactly like authMiddleware. A
    // normal API/XHR caller (which can set Authorization) gets no query-token path.
    if (!token && req.query && req.query.token &&
        typeof req.headers.accept === 'string' && req.headers.accept.includes('text/event-stream')) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth for the static /uploads route. Uploaded logos/signatures are referenced from
// plain <img src="/uploads/..."> tags, which cannot send an Authorization header, so a
// valid token must be accepted from the query string as well. This is intentionally
// permissive about token transport (header OR query) but still REQUIRES a valid token,
// so uploads are no longer world-readable by guessing Date.now() filenames.
// RESIDUAL RISK: like SSE, a query-string token can leak into logs; callers should
// append the short-lived access token (e.g. /uploads/x.png?token=<jwt>). Full per-tenant
// file-ownership checks are out of scope here — this guarantees authentication only.
const uploadsAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    // Same-origin (CRA proxy) cookie auth: <img src="/uploads/..."> sends the httpOnly `token`
    // cookie automatically now that /uploads is same-origin, so prefer it first.
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { authMiddleware, sseAuthMiddleware, uploadsAuthMiddleware, JWT_SECRET };
