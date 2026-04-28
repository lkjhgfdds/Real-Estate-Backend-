const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/user.model');
const { verifyGoogleToken } = require('../src/services/google.auth.service');

jest.mock('../src/services/google.auth.service');

describe('Google Auth Controller', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    verifyGoogleToken.mockReset();
  });

  it('should register a new user via Google', async () => {
    const mockPayload = {
      googleId: 'google123',
      email: 'newuser@gmail.com',
      name: 'New User',
      picture: 'https://example.com/photo.jpg',
      emailVerified: true
    };
    verifyGoogleToken.mockResolvedValue(mockPayload);

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe(mockPayload.email);
    expect(res.body.data.user.authProvider).toBe('google');
    expect(res.body.data.accessToken).toBeDefined();
    
    const user = await User.findOne({ email: mockPayload.email }).select('+googleId');
    expect(user).toBeDefined();
    expect(user.googleId).toBe(mockPayload.googleId);
  });

  it('should link Google account to an existing local user', async () => {
    const email = 'existing@gmail.com';
    await User.create({
      name: 'Existing User',
      email,
      password: 'password123',
      authProvider: 'local',
      isVerified: true
    });

    const mockPayload = {
      googleId: 'google456',
      email,
      name: 'Existing User',
      picture: 'https://example.com/photo.jpg',
      emailVerified: true
    };
    verifyGoogleToken.mockResolvedValue(mockPayload);

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'valid_token' });

    expect(res.status).toBe(200);
    const user = await User.findOne({ email }).select('+googleId');
    expect(user.googleId).toBe(mockPayload.googleId);
    expect(user.authProvider).toBe('google');
  });

  it('should login an existing Google user', async () => {
    const email = 'googleuser@gmail.com';
    const googleId = 'google789';
    await User.create({
      name: 'Google User',
      email,
      googleId,
      authProvider: 'google',
      isVerified: true
    });

    const mockPayload = {
      googleId,
      email,
      name: 'Google User',
      picture: 'https://example.com/photo.jpg',
      emailVerified: true
    };
    verifyGoogleToken.mockResolvedValue(mockPayload);

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
  });

  it('should return 401 for invalid Google token', async () => {
    verifyGoogleToken.mockRejectedValue(new Error('Invalid token'));

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'invalid_token' });

    expect(res.status).toBe(401);
  });
});
