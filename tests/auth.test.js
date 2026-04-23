/**
 * Authentication Tests
 * Covers: register, login, /me, logout.
 *
 * NOTE: Registration creates unverified users.
 * Login requires isVerified = true, so tests that need login
 * use the global `createVerifiedUser` helper from setup.js.
 */

const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/user.model');
const mongoose = require('mongoose');
const { createVerifiedUser } = require('./setup'); // helper to create verified users

describe('Auth Routes', () => {

  // Clean up users after each test to avoid duplicate email issues
  afterEach(async () => {
    await User.deleteMany({});
  });

  // Close DB connection after all tests
  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ── Registration ──────────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully (status 201)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should always assign "buyer" role (ignores role in payload)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Hacker', email: 'hacker@example.com', password: 'pass123', role: 'admin' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('buyer');
    });

    it('should reject duplicate email with 400', async () => {
      await request(app).post('/api/v1/auth/register')
        .send({ name: 'User1', email: 'dup@example.com', password: 'pass123' });

      const res = await request(app).post('/api/v1/auth/register')
        .send({ name: 'User2', email: 'dup@example.com', password: 'pass456' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should reject missing required fields with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'noname@example.com' });

      expect(res.status).toBe(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    let verifiedUser;

    beforeEach(async () => {
      // Create a verified user before each login test
      verifiedUser = await createVerifiedUser(request, app, {
        name: 'Login User', email: 'login@example.com', password: 'correctpass',
      });
    });

    it('should login with correct credentials and return tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'correctpass' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should reject wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@example.com', password: 'pass123' });

      expect(res.status).toBe(401);
    });

    it('should reject unverified user with 403', async () => {
      // Register without verifying
      await request(app).post('/api/v1/auth/register')
        .send({ name: 'Unverified', email: 'unverified@example.com', password: 'pass123' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unverified@example.com', password: 'pass123' });

      expect(res.status).toBe(403);
    });
  });

  // ── Protected: /me ───────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return current user profile when authenticated', async () => {
      const { token } = await createVerifiedUser(request, app, {
        name: 'Me User', email: 'me@example.com', password: 'pass123',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('me@example.com');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid/malformed token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });

  // ── Logout ───────────────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const { token, refreshToken } = await createVerifiedUser(request, app, {
        name: 'Logout User', email: 'logout@example.com', password: 'pass123',
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

});