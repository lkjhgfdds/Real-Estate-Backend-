const { getClient, isRedisEnabled } = require('../config/redis');
const logger = require('../utils/logger');

const cacheMiddleware = (durationSeconds = 60) => (req, res, next) => {
  if (req.headers.authorization) return next();

  if (!isRedisEnabled()) return next();

  const key = `cache:${req.originalUrl}`;
  const client = getClient();

  client
    .get(key)
    .then((cached) => {
      if (cached) return res.status(200).json(JSON.parse(cached));

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode === 200) {
          client.setEx(key, durationSeconds, JSON.stringify(data)).catch(() => {});
        }
        return originalJson(data);
      };

      next();
    })
    .catch(() => next());
};

const clearCache = async (pattern) => {
  if (!isRedisEnabled()) return;

  try {
    const client = getClient();
    const keys = await client.keys(`cache:*${pattern}*`);
    if (keys.length) await client.del(keys);
  } catch (e) {
    logger.warn('Cache clear error:', e.message);
  }
};

module.exports = { cacheMiddleware, clearCache };
