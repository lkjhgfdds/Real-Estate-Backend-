// Redis configuration — optional (falls back to in-memory cache if Redis unavailable)
// To enable: set REDIS_URL in .env

let redisClient = null;
let useRedis    = false;

const connectRedis = async () => {
  if (!process.env.REDIS_URL) return;
  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => {
      const logger = require('../utils/logger');
      logger.warn('Redis error — falling back to in-memory cache:', err.message);
      useRedis = false;
    });
    await redisClient.connect();
    useRedis = true;
    const logger = require('../utils/logger');
    logger.info('✅ Redis connected');
  } catch (err) {
    const logger = require('../utils/logger');
    logger.warn('Redis unavailable — using in-memory cache:', err.message);
    useRedis = false;
  }
};

const getClient = () => redisClient;
const isRedisEnabled = () => useRedis;

// Cache helpers for high-frequency lookups (e.g., banned user status)
const cacheGet = async (key) => {
  if (!useRedis || !redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (err) {
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds = 300) => {
  if (!useRedis || !redisClient) return false;
  try {
    await redisClient.setEx(key, ttlSeconds, value);
    return true;
  } catch (err) {
    return false;
  }
};

const cacheDel = async (key) => {
  if (!useRedis || !redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = { connectRedis, getClient, isRedisEnabled, cacheGet, cacheSet, cacheDel };
