'use strict';

/**
 * Google OAuth Controller
 * POST /api/v1/auth/google
 * ─────────────────────────────────────────────────────────────
 * Flow:
 *   1. Frontend obtains idToken from Google Sign-In SDK
 *   2. Frontend sends { idToken } to this endpoint
 *   3. Backend verifies token cryptographically
 *   4. Upsert user (create or link Google account)
 *   5. Issue JWT access + refresh tokens (same as normal login)
 *
 * Edge cases handled:
 *   A. Brand-new user  → create account (isVerified = true, no OTP)
 *   B. Existing local  → link googleId to existing account
 *   C. Existing Google → direct login
 *   D. Banned/inactive → reject with 403
 *   E. Invalid token   → reject with 401
 */

const asyncHandler        = require('../../utils/asyncHandler');
const AppError            = require('../../utils/AppError');
const User                = require('../../models/user.model');
const RefreshToken        = require('../../models/refreshToken.model');
const { signToken, signRefreshToken } = require('../../utils/jwt');
const { verifyGoogleToken }           = require('../../services/google.auth.service');
const logger = require('../../utils/logger');

// Safe user projection — never expose sensitive fields in response
const SAFE_PROJECTION = '-password -googleId -otpHash -otpExpires -otpAttempts '
  + '-passwordResetToken -passwordResetExpiry -loginAttempts -lockUntil '
  + '-tokenVersion -__v';

/**
 * POST /api/v1/auth/google
 */
exports.googleAuth = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  // ── 1. Input validation ──────────────────────────────────────
  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    return next(new AppError(req.t('AUTH.GOOGLE_TOKEN_REQUIRED'), 400));
  }

  // ── 2. Cryptographic token verification ──────────────────────
  let googlePayload;
  try {
    googlePayload = await verifyGoogleToken(idToken.trim());
  } catch (err) {
    logger.warn(`[GoogleAuth] Token verification failed: ${err.message}`);
    // Do NOT expose internal error details — generic 401
    return next(new AppError(req.t('AUTH.GOOGLE_INVALID_TOKEN'), 401));
  }

  const { googleId, email, name, picture, emailVerified } = googlePayload;

  // Google should always return verified emails, but guard anyway
  if (!emailVerified) {
    return next(new AppError(req.t('AUTH.GOOGLE_EMAIL_NOT_VERIFIED'), 400));
  }

  // ── 3. Find existing user ────────────────────────────────────
  // Search by googleId first (fastest), then fall back to email
  // This handles the "link" case: user registered with email → now signs in with Google
  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  }).select('+googleId +tokenVersion');

  // ── 4. Account state checks ──────────────────────────────────
  if (user) {
    if (user.isBanned) {
      return next(new AppError(req.t('COMMON.ACCOUNT_BANNED'), 403));
    }
    if (!user.isActive) {
      return next(new AppError(req.t('COMMON.ACCOUNT_SUSPENDED'), 403));
    }

    // Case B: existing local user — link googleId if not already linked
    if (!user.googleId) {
      user.googleId      = googleId;
      user.authProvider  = 'google';
      // Update photo only if user has no photo yet
      if (!user.photo && picture) user.photo = picture;
      // Google accounts are already verified
      user.isVerified = true;
      await user.save({ validateBeforeSave: false });
      logger.info(`[GoogleAuth] Linked Google account to existing user: ${user._id}`);
    }
    // Case C: returning Google user — no changes needed
  } else {
    // ── 5. Create new user (Case A) ───────────────────────────
    user = await User.create({
      name,
      email,
      googleId,
      authProvider:  'google',
      photo:         picture || null,
      isVerified:    true,   // Google already verified the email
      role:          'buyer', // default — user can upgrade via KYC later
    });
    logger.info(`[GoogleAuth] New user registered via Google: ${user._id} (${email})`);
  }

  // ── 6. Issue JWT tokens ──────────────────────────────────────
  const accessToken    = signToken(user._id, user.tokenVersion);
  const newRefreshToken = signRefreshToken(user._id, user.tokenVersion);

  await RefreshToken.create({
    userId:    user._id,
    tokenHash: RefreshToken.hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: req.headers['user-agent'] || '',
    ip:        req.ip || '',
  });

  // Set httpOnly cookie for refresh token (same as normal login)
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/',
  });

  // ── 7. Safe user object for response ─────────────────────────
  const safeUser = await User.findById(user._id).select(SAFE_PROJECTION).lean();

  res.status(200).json({
    status:  'success',
    message: req.t('AUTH.GOOGLE_LOGIN_SUCCESS'),
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      user: safeUser,
    },
  });
});
