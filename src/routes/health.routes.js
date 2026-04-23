const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const os       = require('os');

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 */
router.get('/', async (req, res) => {
  const dbState = ['disconnected','connected','connecting','disconnecting'];
  const memUsage = process.memoryUsage();

  const health = {
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '3.0.0',
    uptime:    `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: dbState[mongoose.connection.readyState] || 'unknown',
        name:   mongoose.connection.name || 'N/A',
      },
      server: {
        memory: {
          heapUsed:  `${Math.round(memUsage.heapUsed  / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          rss:       `${Math.round(memUsage.rss       / 1024 / 1024)}MB`,
        },
        platform: process.platform,
        nodeVersion: process.version,
        cpus:        os.cpus().length,
        loadAvg:     os.loadavg().map(v => v.toFixed(2)),
      },
    },
  };

  const httpStatus = mongoose.connection.readyState === 1 ? 200 : 503;
  if (httpStatus === 503) health.status = 'degraded';

  res.status(httpStatus).json(health);
});

// Lightweight liveness probe (for container orchestration)
router.get('/ping', (req, res) => res.status(200).json({ status: 'ok', message: 'pong' }));

module.exports = router;
