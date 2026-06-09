const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    message: isProduction ? 'Internal server error' : err.message,
    ...(err.code && { code: err.code }),
    stack: isProduction ? null : err.stack,
  });
};

module.exports = { errorHandler };
