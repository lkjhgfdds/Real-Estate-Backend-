const { trackPropertyView } = require('../services/analytics.service');

// Middleware to track property page views automatically
const trackView = async (req, res, next) => {
  next(); // don't block the response
  // Track async after response is sent
  if (req.params.id) {
    trackPropertyView(
      req.params.id,
      req.user?._id || null,
      req.ip,
      req.headers['user-agent']
    ).catch(() => {});
  }
};

module.exports = trackView;
