const { getClient, isRedisEnabled } = require('../config/redis');
const logger = require('../utils/logger');

// Hybrid cache: Redis if available, in-memory fallback
const memCache = new Map();

const cacheMiddleware = (durationSeconds = 60) => (req, res, next) => {
  if (req.headers.authorization) return next();

  const key = `cache:${req.originalUrl}`;

  // ── Redis path ────────────────────────────────────────────
  if (isRedisEnabled()) {
    const client = getClient();
    client.get(key)
      .then((cached) => {
        if (cached) return res.status(200).json(JSON.parse(cached));
        const orig = res.json.bind(res);
        res.json = (data) => {
          if (res.statusCode === 200) {
            client.setEx(key, durationSeconds, JSON.stringify(data)).catch(() => {});
          }
          return orig(data);
        };
        next();
      })
      .catch(() => next());
    return;
  }

  // ── In-memory fallback ────────────────────────────────────
  const cached = memCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return res.status(200).json(cached.data);
  }
  const orig = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200) {
      memCache.set(key, { data, expiry: Date.now() + durationSeconds * 1000 });
    }
    return orig(data);
  };
  next();
};

const clearCache = async (pattern) => {
  // Redis
  if (isRedisEnabled()) {
    try {
      const client = getClient();
      const keys = await client.keys(`cache:*${pattern}*`);
      if (keys.length) await client.del(keys);
    } catch (e) { logger.warn('Cache clear error:', e.message); }
  }
  // In-memory
  for (const key of memCache.keys()) {
    if (key.includes(pattern)) memCache.delete(key);
  }
};

module.exports = { cacheMiddleware, clearCache };
