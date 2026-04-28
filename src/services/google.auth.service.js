'use strict';

/**
 * Google OAuth Service
 * ─────────────────────────────────────────────────────────────
 * Architecture: Token-Verify pattern
 *   - Frontend (Angular) triggers Google Sign-In via @google/oauth2
 *   - Frontend receives idToken from Google
 *   - Frontend sends idToken to POST /api/v1/auth/google
 *   - Backend (this service) verifies the idToken cryptographically
 *     using google-auth-library → no redirect / no OAuth callback URL
 *
 * Security guarantees:
 *   - Audience check: rejects tokens issued for other Client IDs
 *   - Expiry check: google-auth-library rejects expired tokens
 *   - Signature check: verified against Google's public keys
 */

const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Singleton client — created once per process, reused per request
let _client = null;
const getClient = () => {
  if (!_client) {
    if (!CLIENT_ID) throw new Error('[GoogleAuth] GOOGLE_CLIENT_ID is not set in .env');
    _client = new OAuth2Client(CLIENT_ID);
  }
  return _client;
};

/**
 * verifyGoogleToken
 * ─────────────────────────────────────────────────────────────
 * @param {string} idToken   - Raw Google ID token from frontend
 * @returns {Promise<{googleId, email, name, picture, emailVerified}>}
 * @throws  {Error}          - If token is invalid, expired, or audience mismatch
 */
const verifyGoogleToken = async (idToken) => {
  const client = getClient();

  // verifyIdToken performs:
  //   1. Cryptographic signature verification (RSA)
  //   2. Expiry check
  //   3. Audience (aud) check against CLIENT_ID
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });

  const payload = ticket.getPayload();

  // Google guarantees these fields exist for G-accounts
  return {
    googleId:      payload.sub,              // Stable unique Google user ID
    email:         payload.email,
    emailVerified: payload.email_verified,   // Google-verified email flag
    name:          payload.name,
    picture:       payload.picture || null,
  };
};

module.exports = { verifyGoogleToken };
