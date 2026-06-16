const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// Rate limiting is ALWAYS enforced so production safety never silently depends on
// NODE_ENV being set. Dev caps are generous enough not to interfere with local work;
// production caps are strict. Set DISABLE_RATE_LIMIT=true only for load testing.
const disabled = process.env.DISABLE_RATE_LIMIT === 'true';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50000 : 1000,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
});

module.exports = { apiLimiter, authLimiter };
