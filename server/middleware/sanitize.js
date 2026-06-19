// NoSQL operator-injection guard.
//
// Mongoose treats object KEYS like `$ne`, `$gt`, `$where` (and dotted paths like
// `a.b`) as query operators. If those keys arrive from user input (e.g.
// {"email": {"$ne": null}}) they can subvert queries. This middleware recursively
// removes any key starting with `$` or containing `.` from the request payloads.
//
// Only object KEYS are dangerous — string/number VALUES are left untouched, so
// legitimate data (prices, emails, free-text containing `$` or `.`) is preserved.

const isPlainObject = (val) =>
  val !== null && typeof val === 'object' && !Buffer.isBuffer(val);

// Recursively strip operator-like keys, mutating objects/arrays in place.
const sanitizeInPlace = (obj) => {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (isPlainObject(item)) sanitizeInPlace(item);
    }
    return;
  }
  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const value = obj[key];
    if (isPlainObject(value) || Array.isArray(value)) {
      sanitizeInPlace(value);
    }
  }
};

const sanitizeMiddleware = (req, res, next) => {
  try {
    // req.body and req.params are normal writable objects — mutate directly.
    if (req.body) sanitizeInPlace(req.body);
    if (req.params) sanitizeInPlace(req.params);

    // On Express 4, req.query is a getter-only property, so reassigning it throws.
    // Mutate its own properties in place instead (deleting dangerous top-level keys
    // and sanitizing nested structures).
    if (req.query && isPlainObject(req.query)) {
      sanitizeInPlace(req.query);
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = sanitizeMiddleware;
