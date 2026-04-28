// ──────────────────────────────────────────────────────────
// KYC (Know Your Customer) Verification Middleware
// ──────────────────────────────────────────────────────────

/**
 * Enforce KYC approval for sensitive operations
 * Blocks users unless kycStatus === 'approved'
 * 
 * Usage:
 * router.post('/property', protect, requireKYC, controller);
 */
const requireKYC = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'fail', message: req.t('COMMON.LOGIN_REQUIRED') });
  }

  if (req.user.kycStatus !== 'approved') {
    return res.status(403).json({
      status: 'fail',
      message: req.t('KYC.REQUIRED'),
      kycStatus: req.user.kycStatus,
      help: req.t('KYC.KYC_HELP'),
      kycRejectionReason: req.user.kycRejectionReason || null,
    });
  }

  next();
};

/**
 * Add KYC status info to request (optional, doesn't block)
 * Useful for endpoints that want to inform user about KYC status
 */
const attachKYCStatus = (req, res, next) => {
  if (req.user) {
    req.kyc = {
      status: req.user.kycStatus,
      submitted: !!req.user.kycSubmittedAt,
      approved: req.user.kycStatus === 'approved',
      rejected: req.user.kycStatus === 'rejected',
      pending: req.user.kycStatus === 'pending',
    };
  }
  next();
};

module.exports = { requireKYC, attachKYCStatus };
