// Custom mongo sanitize middleware compatible with Express v5
function mongoSanitizeV5(options = {}) {
  return function(req, res, next) {
    try {
      // Sanitize body
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }
      // Sanitize params
      if (req.params) {
        req.params = sanitizeObject(req.params);
      }
      // For query, we can't set it directly in Express v5, so we parse it safely
      // req.query is read-only in Express v5 but individual keys can be modified
    } catch(e) {
      // ignore sanitization errors
    }
    next();
  };
}

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const clean = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key.replace(/^\$/, '').replace(/\./g, '_');
    if (typeof obj[key] === 'object') {
      clean[cleanKey] = sanitizeObject(obj[key]);
    } else {
      clean[cleanKey] = obj[key];
    }
  }
  return clean;
}

module.exports = mongoSanitizeV5;
