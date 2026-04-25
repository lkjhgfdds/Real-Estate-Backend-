const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/user.model');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'fail', message: 'You must be logged in first' });
    }

    // ✅ We used clean function instead of jwt.verify directly
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id).select('+passwordChangedAt +isActive +isBanned +isVerified');
    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: 'fail', message: 'This account is suspended' });
    }

    if (user.isBanned) {
      return res.status(403).json({ status: 'fail', message: 'This account is banned' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ status: 'fail', message: 'Please verify your email first' });
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt) {
      const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedAt) {
        return res.status(401).json({ status: 'fail', message: 'Password was recently changed, please log in again' });
      }
    }

    const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    if (tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ status: 'fail', message: 'Session is no longer valid, please log in again' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'fail', message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'fail', message: 'Token has expired' });
    }
    next(err);
  }
};
