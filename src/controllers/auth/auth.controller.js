const crypto        = require('crypto');
const User          = require('../../models/user.model');
const RefreshToken  = require('../../models/refreshToken.model');
const asyncHandler  = require('../../utils/asyncHandler');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { sendPasswordResetEmail, sendVerificationEmail }   = require('../../services/email.service');
const logger = require('../../utils/logger');

// ─── Helper ─────────────────────────────────────────────────
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Helper: build & set the refresh-token httpOnly cookie
const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/',
  });

// Helper: persist a new RefreshToken document
const persistRefreshToken = (userId, token, req) =>
  RefreshToken.create({
    userId,
    tokenHash: RefreshToken.hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: req.headers['user-agent'] || '',
    ip:        req.ip || '',
  });

// ─── Register ───────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ status: 'fail', message: 'Email already in use' });
  }

  // role is always forced to 'buyer' — never trust client-supplied role
  const user = await User.create({ name, email, password, phone, role: 'buyer' });

  // Hash and store OTP
  const otp = generateOTP();
  user.otpHash    = crypto.createHash('sha256').update(otp).digest('hex');
  user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  try {
    await sendVerificationEmail(user.email, otp);
    logger.info(`[Email] OTP sent to ${user.email}`);
  } catch (emailError) {
    logger.error(`[Email] Failed to send OTP to ${user.email}: ${emailError.message}`);
    // Non-blocking — user still created; they can resend OTP
  }

  user.password = undefined;
  res.status(201).json({
    status:  'success',
    message: 'Registration successful. Please check your email for OTP verification.',
    data:    { user },
  });
});

// ─── Update User Role (Admin Only) ──────────────────────────
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { userId, newRole } = req.body;

  const ALLOWED_ROLES = ['buyer', 'owner', 'agent'];
  if (!ALLOWED_ROLES.includes(newRole)) {
    return res.status(400).json({
      status:  'fail',
      message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`,
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' });
  }

  const oldRole = user.role;
  user.role = newRole;
  await user.save({ validateBeforeSave: false });

  logger.info(
    `[RoleChange] Admin ${req.user._id} changed user ${userId} role from '${oldRole}' to '${newRole}'`
  );

  res.status(200).json({
    status:  'success',
    message: `User role updated successfully from '${oldRole}' to '${newRole}'`,
    data: {
      user: {
        _id:       user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        updatedAt: user.updatedAt,
      },
    },
  });
});

// ─── Verify OTP ─────────────────────────────────────────────
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts');

  if (!user) return res.status(400).json({ status: 'fail', message: 'User not found' });
  if (user.isVerified) return res.status(400).json({ status: 'fail', message: 'Account already verified' });

  const isValidOTP = user.verifyOTP(otp);
  if (!isValidOTP) {
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ status: 'fail', message: 'Invalid or expired OTP' });
  }

  user.isVerified = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ status: 'success', message: 'Email verified successfully. You can now login.' });
});

// ─── Resend OTP ─────────────────────────────────────────────
exports.resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts');

  if (!user) return res.status(400).json({ status: 'fail', message: 'User not found' });
  if (user.isVerified) return res.status(400).json({ status: 'fail', message: 'Account already verified' });

  const otp = user.createOTP();
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(user.email, otp).catch(e =>
    logger.warn(`[ResendOTP] Email send failed: ${e.message}`)
  );

  // rawOTP is intentionally NOT returned in the response (security)
  res.status(200).json({ status: 'success', message: 'OTP resent successfully' });
});

// ─── Login ──────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email })
    .select('+password +isActive +isVerified +loginAttempts +lockUntil');
  if (!user) return res.status(401).json({ status: 'fail', message: 'Email or password is incorrect' });

  if (user.isLocked && user.isLocked()) {
    return res.status(403).json({
      status:  'fail',
      message: 'Account temporarily locked due to failed login attempts',
    });
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    if (user.incLoginAttempts) user.incLoginAttempts();
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ status: 'fail', message: 'Email or password is incorrect' });
  }

  if (!user.isActive)   return res.status(403).json({ status: 'fail', message: 'Account is suspended' });
  if (!user.isVerified) return res.status(403).json({ status: 'fail', message: 'Please verify your email first' });

  // Reset brute-force counters
  user.loginAttempts = 0;
  user.lockUntil     = undefined;
  await user.save({ validateBeforeSave: false });

  const accessToken  = signToken(user._id, user.tokenVersion);
  const refreshToken = signRefreshToken(user._id, user.tokenVersion);

  await persistRefreshToken(user._id, refreshToken, req);
  setRefreshCookie(res, refreshToken);

  user.password = undefined;
  res.status(200).json({
    status:       'success',
    token:        accessToken,
    // refreshToken is also returned in the body for mobile/API clients
    // that cannot read httpOnly cookies (e.g. Supertest in tests).
    refreshToken,
    data: {
      user: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    },
  });
});

// ─── Refresh Token ──────────────────────────────────────────
// Intentional: catch returns 401 (not next(err)) — any error here means the
// refresh token is invalid, so we respond uniformly with 401.
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ status: 'fail', message: 'Refresh token is required' });

    const decoded   = verifyRefreshToken(refreshToken);
    const tokenHash = RefreshToken.hashToken(refreshToken);

    const storedToken = await RefreshToken.findOne({ tokenHash, userId: decoded.id, isRevoked: false });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ status: 'fail', message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ status: 'fail', message: 'User not found or banned' });
    }

    // Token rotation — revoke old, issue new
    await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });

    const newAccessToken  = signToken(user._id, user.tokenVersion);
    const newRefreshToken = signRefreshToken(user._id, user.tokenVersion);

    await persistRefreshToken(user._id, newRefreshToken, req);
    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({ status: 'success', token: newAccessToken, refreshToken: newRefreshToken });
  } catch (_err) {
    // Any JWT / DB error → treat as invalid token
    return res.status(401).json({ status: 'fail', message: 'Invalid or expired refresh token' });
  }
};

// ─── Logout ─────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (refreshToken) {
    const tokenHash = RefreshToken.hashToken(refreshToken);
    await RefreshToken.findOneAndUpdate(
      { tokenHash, userId: req.user._id },
      { isRevoked: true }
    );
  }

  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

// ─── Logout All Devices ──────────────────────────────────────
exports.logoutAll = asyncHandler(async (req, res) => {
  await RefreshToken.updateMany({ userId: req.user._id }, { isRevoked: true });
  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ status: 'success', message: 'Logged out from all devices successfully' });
});

// ─── Forgot Password ─────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'fail', message: 'Email is required' });

  const user = await User.findOne({ email });
  // Always return 200 to prevent email enumeration
  if (!user) {
    return res.status(200).json({ status: 'success', message: 'If email is registered, you will receive a message' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user.email, resetToken);
    logger.info(`[Password Reset] Email sent to ${user.email}`);
  } catch (emailError) {
    logger.error(`[Password Reset] Failed to send email: ${emailError.message}`);
    // Roll back the token so the user can retry
    user.passwordResetToken  = undefined;
    user.passwordResetExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    throw emailError; // propagate — error middleware returns 500
  }

  res.status(200).json({ status: 'success', message: 'If email is registered, you will receive a message' });
});

// ─── Reset Password ──────────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token }    = req.params;
  const { password } = req.body;

  // FIX: schema min is 8, guard must match
  if (!password || password.length < 8) {
    return res.status(400).json({ status: 'fail', message: 'Password must be at least 8 characters' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken:  hashedToken,
    passwordResetExpiry: { $gt: Date.now() },
  });

  if (!user) return res.status(400).json({ status: 'fail', message: 'Link is invalid or expired' });

  user.password            = password;
  user.passwordResetToken  = undefined;
  user.passwordResetExpiry = undefined;
  await user.save();

  // Revoke all old sessions
  await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

  const newAccessToken  = signToken(user._id, user.tokenVersion);
  const newRefreshToken = signRefreshToken(user._id, user.tokenVersion);

  await RefreshToken.create({
    userId:    user._id,
    tokenHash: RefreshToken.hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  setRefreshCookie(res, newRefreshToken);

  res.status(200).json({
    status:  'success',
    message: 'Password reset successfully',
    token:   newAccessToken,
  });
});

// NOTE: getMe endpoint is in user.controller.js for better organisation
