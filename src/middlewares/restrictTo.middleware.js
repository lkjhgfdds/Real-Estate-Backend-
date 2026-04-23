module.exports = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'fail', message: 'You must be logged in' });
  }

  // Check account status
  if (!req.user.isActive) {
    return res.status(403).json({ status: 'fail', message: 'Account is suspended' });
  }
  if (req.user.isBanned) {
    return res.status(403).json({ status: 'fail', message: 'Account is banned' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to perform this action' });
  }

  next();
};