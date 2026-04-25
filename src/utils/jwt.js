const jwt = require('jsonwebtoken');

// FIX — Check key existence on startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in .env');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is required in .env — must be different from JWT_SECRET');
}

// Access Token — expires according to JWT_EXPIRES_IN (default 15m)
exports.signToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

// Refresh Token — expires in 30 days
exports.signRefreshToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tokenVersion }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });

// Verify Access Token
exports.verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

// Verify Refresh Token
exports.verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
