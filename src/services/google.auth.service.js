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

// Explicit hardcoded fallback + env variable
const clientID = process.env.GOOGLE_CLIENT_ID || '668341342866-ufmo1js3tbrv5nkeakgtn81kjsp9r3if.apps.googleusercontent.com';

// Validation: ensure CLIENT_ID is correctly loaded
if (!clientID.startsWith('6683')) {
  throw new Error(
    `[CRITICAL] GOOGLE_CLIENT_ID is invalid or not loaded. ` +
    `Expected to start with '6683', got: ${clientID}. ` +
    `Check .env file and ensure process.env.GOOGLE_CLIENT_ID is set.`
  );
}

// Singleton client — created once per process, reused per request
let _client = null;
const getClient = () => {
  if (!_client) {
    console.log(`[GoogleAuth] Loaded CLIENT_ID: ${clientID}`);
    _client = new OAuth2Client(clientID);
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

  // Debug: Log the token prefix and CLIENT_ID being used
  console.log(`[Auth-Debug] Client ID in use: ${CLIENT_ID}`);
  console.log(`[Auth-Debug] Token prefix (first 50 chars): ${idToken.substring(0, 50)}...`);

  try {
    // verifyIdToken performs:
    //   1. Cryptographic signature verification (RSA)
    //   2. Expiry check
    //   3. Audience (aud) check against CLIENT_ID
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientID,
    });

    const payload = ticket.getPayload();

    // Google guarantees these fields exist for G-accounts
    console.log(`[Auth-Debug] Token verified successfully for email: ${payload.email}`);
    return {
      googleId:      payload.sub,              // Stable unique Google user ID
      email:         payload.email,
      emailVerified: payload.email_verified,   // Google-verified email flag
      name:          payload.name,
      picture:       payload.picture || null,
    };
  } catch (err) {
    console.error(`[Auth-Debug] Token verification error:`);
    console.error(`  Message: ${err.message}`);
    console.error(`  Code: ${err.code || 'N/A'}`);
    console.error(`  Expected audience: ${clientID}`);
    console.error('[Auth-Error-Message]:', err.message);
    console.error('[Auth-Error-Stack]:', err.stack);
    throw err;
  }
};

module.exports = { verifyGoogleToken };
