const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log full details server-side for debugging/auditing — never sent to the client.
  console.error('[ErrorHandler]', {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
  });

  // In production, return a generic message and never leak raw error.message or stack to the
  // client. In non-production, keep verbose details (message + stack) to aid debugging.
  res.status(statusCode).json({
    message: isProduction ? 'Internal server error' : err.message,
    ...(err.code && { code: err.code }),
    stack: isProduction ? null : err.stack,
  });
};

module.exports = { errorHandler };
