const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Attach requestId for traceability
  const requestId = req.requestId || 'N/A';

  // Log all errors
  logger.error(`[${requestId}] ${err.message} | ${req.method} ${req.originalUrl} | ${err.stack || ''}`);
  if (process.env.NODE_ENV !== 'production') console.error('Full error:', err);

  // Operational errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({ status: err.status || 'fail', message: err.message, requestId });
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    return res.status(400).json({ status: 'fail', message: `Invalid value for: ${err.path}`, requestId });
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({ status: 'fail', message: `Duplicate value for ${field}`, requestId });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ status: 'fail', message: 'Validation failed', errors, requestId });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ status: 'fail', message: 'Invalid token', requestId });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ status: 'fail', message: 'Token expired', requestId });

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ status: 'fail', message: 'File size exceeds the limit', requestId });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ status: 'fail', message: 'Too many files uploaded', requestId });

  // Fallback for unhandled errors
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    status: 'error',
    message: isDev ? err.message : 'Internal server error',
    requestId,
    ...(isDev && { stack: err.stack }),
  });
};