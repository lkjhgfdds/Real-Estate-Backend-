/**
 * Global Test Setup
 * Uses MongoMemoryServer for isolated, in-memory MongoDB testing.
 * Provides a global helper for creating pre-verified users.
 */

const mongoose              = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const path = require('path');

let mongod;

// ─── Global Setup ──────────────────────────────────────────────
beforeAll(async () => {
  const baseDir = path.join('D:', 'temp', 'mongodb');
  mongod = await MongoMemoryServer.create({
    binary: { 
      systemBinary: 'C:\\Users\\ElRaed\\.cache\\mongodb-binaries\\mongod-x64-win32-8.2.1.exe' 
    },
    instance: { 
      dbPath: path.join(baseDir, 'data')
    }
  });
  const uri = mongod.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri);

  process.env.JWT_SECRET         = 'test_secret_key_at_least_32_chars_long_for_test';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_different_key_for_test_env';
  process.env.JWT_EXPIRES_IN     = '1d';
  process.env.NODE_ENV           = 'test';
  process.env.MONGO_URI          = uri;
  process.env.CLIENT_URL         = 'http://localhost:3000';
  process.env.REDIS_URL          = '';   // disable Redis in tests
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// NOTE: Global afterEach cleanup is intentionally removed.
// Each test file manages its own cleanup (afterEach or afterAll).
// Cross-file contamination is impossible — every file gets a fresh
// MongoMemoryServer from the beforeAll above.

/**
 * Helper: register + verify + login a user in one step.
 * Returns { token, refreshToken, user }
 */
global.createVerifiedUser = async (request, app, { name, email, password, role = 'buyer', kycStatus = 'approved' } = {}) => {
  const User = require('../src/models/user.model');

  // 1. Register
  const regRes = await request(app).post('/api/v1/auth/register').send({ name, email, password });
  if (regRes.status !== 201) {
    throw new Error(`Register failed for ${email}: ${JSON.stringify(regRes.body)}`);
  }

  // 2. Mark as verified, set role, and set KYC status directly in DB
  await User.findOneAndUpdate({ email }, { isVerified: true, role, kycStatus });

  // 3. Login
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    token:        loginRes.body.token,
    refreshToken: loginRes.body.refreshToken,
    user:         loginRes.body.data.user,
  };
};
