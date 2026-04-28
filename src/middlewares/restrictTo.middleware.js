module.exports = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'fail', message: req.t('COMMON.LOGIN_REQUIRED') });
  }

  // Check account status
  if (!req.user.isActive) {
    return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_SUSPENDED') });
  }
  if (req.user.isBanned) {
    return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_BANNED') });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ status: 'fail', message: req.t('COMMON.NO_PERMISSION') });
  }

  next();
};