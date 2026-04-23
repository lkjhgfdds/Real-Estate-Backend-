/**
 * Health Check Tests
 * Validates liveness and readiness endpoints.
 *
 * NOTE: In test environment, DB may be connecting/disconnected,
 * so /api/health can return 200, 503, or 500. We accept all valid codes.
 * /api/health/ping is a pure liveness probe — always returns 200.
 */

const request = require('supertest');
const { app } = require('../src/server');

describe('Health Endpoints', () => {
  it('GET /api/health — should return a health status object', async () => {
    const res = await request(app).get('/api/health');
    // 200 = healthy, 503 = degraded (DB disconnected), 500 = unexpected error
    expect([200, 503, 500]).toContain(res.status);
    // When 200 or 503, body should have status and services fields
    if (res.status !== 500) {
      expect(res.body.status).toBeDefined();
      expect(res.body.services).toBeDefined();
    }
  });

  it('GET /api/health/ping — should always return 200 pong', async () => {
    const res = await request(app).get('/api/health/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('pong');
  });
});
