const crypto       = require('crypto');
const User         = require('../../models/user.model');
const RefreshToken = require('../../models/refreshToken.model');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../../services/email.service');
const logger = require('../../utils/logger');

// ─── Helper: Generate OTP ───────────────────────────────
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// ─── Register ───────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: "fail", message: "Email already in use" });
    }

    // Create new user
    const user = await User.create({ name, email, password, phone, role: "buyer" });

    // Generate OTP and store in database
    const otp = generateOTP();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    user.otpHash = otpHash;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // Send OTP via email
    try {
      await sendVerificationEmail(user.email, otp);
      logger.info(`[Email]  OTP sent to ${user.email}`);
    } catch (emailError) {
      logger.error(`[Email] ❌ Failed to send OTP to ${user.email}`);
      logger.error(`[Email] Error message: ${emailError.message}`);
      logger.error(`[Email] Error code: ${emailError.code}`);
      logger.error(`[Email] Full error:`, emailError);
    }

    // Remove password from response
    user.password = undefined;

    res.status(201).json({
      status: "success",
      message: "Registration successful. Please check your email for OTP verification.",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update User Role (Admin Only) ──────────────────────
// 🔒 SECURITY: This endpoint can ONLY be called by admin users
// Role changes are logged and tracked for audit purposes
exports.updateUserRole = async (req, res, next) => {
  try {
    const { userId, newRole } = req.body;

    // ✅ Validate role against whitelist
    const ALLOWED_ROLES = ['buyer', 'owner', 'agent'];
    if (!ALLOWED_ROLES.includes(newRole)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    const oldRole = user.role;

    // Update user role
    user.role = newRole;
    await user.save({ validateBeforeSave: false });

    // Log role change for audit trail
    logger.info(`[RoleChange] Admin ${req.user._id} changed user ${userId} role from '${oldRole}' to '${newRole}'`);

    res.status(200).json({
      status: 'success',
      message: `User role updated successfully from '${oldRole}' to '${newRole}'`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Verify OTP ─────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
};


// ─── Resend OTP ─────────────────────────────────────────
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts');

    if (!user) return res.status(400).json({ status: 'fail', message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ status: 'fail', message: 'Account already verified' });

    const otp = user.createOTP();
    await user.save({ validateBeforeSave: false });

    await sendVerificationEmail(user.email, otp).catch(e =>
      logger.warn(`[ResendOTP] Email send failed: ${e.message}`)
    );

    res.status(200).json({ status: 'success', message: 'OTP resent successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Login ──────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +isActive +isVerified +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ status: 'fail', message: 'Email or password is incorrect' });

    if (user.isLocked && user.isLocked()) {
      return res.status(403).json({ status: 'fail', message: 'Account temporarily locked due to failed login attempts' });
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      if (user.incLoginAttempts) user.incLoginAttempts();
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ status: 'fail', message: 'Email or password is incorrect' });
    }

    if (!user.isActive) return res.status(403).json({ status: 'fail', message: 'Account is suspended' });
    if (!user.isVerified) return res.status(403).json({ status: 'fail', message: 'Please verify your email first' });

    // Reset login attempts after successful login
    // Reset login attempts after successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save({ validateBeforeSave: false });

    const accessToken  = signToken(user._id, user.tokenVersion);
    const refreshToken = signRefreshToken(user._id, user.tokenVersion);

    await RefreshToken.create({
      userId:    user._id,
      tokenHash: RefreshToken.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip || '',
    });

    // Set HTTP-only cookie with refresh token (secure approach)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,                        // JS cannot access (XSS protection)
      secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
      sameSite: 'strict',                    // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000,    // 30 days
      path: '/',
    });

    user.password = undefined;
    res.status(200).json({
      status: 'success',
      token: accessToken,
      data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh Token ──────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    // Accept refresh token from cookie OR request body (for flexibility)
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ status: 'fail', message: 'Refresh token is required' });

    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = RefreshToken.hashToken(refreshToken);

    const storedToken = await RefreshToken.findOne({ tokenHash, userId: decoded.id, isRevoked: false });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ status: 'fail', message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ status: 'fail', message: 'User not found or banned' });

    // Revoke old token (token rotation)
    await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });

    const newAccessToken  = signToken(user._id, user.tokenVersion);
    const newRefreshToken = signRefreshToken(user._id, user.tokenVersion);

    await RefreshToken.create({
      userId:    user._id,
      tokenHash: RefreshToken.hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip || '',
    });

    // Set new HTTP-only cookie with rotated refresh token
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({ status: 'success', token: newAccessToken });
  } catch (err) {
    return res.status(401).json({ status: 'fail', message: 'Invalid or expired refresh token' });
  }
};

// ─── Logout ─────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    // Accept refresh token from cookie OR request body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (refreshToken) {
      const tokenHash = RefreshToken.hashToken(refreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash, userId: req.user._id }, { isRevoked: true });
    }

    // Clear the HTTP-only cookie
    res.clearCookie('refreshToken', { path: '/' });

    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Logout All Devices ──────────────────────────────────
exports.logoutAll = async (req, res, next) => {
  try {
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany({ userId: req.user._id }, { isRevoked: true });

    // Clear the HTTP-only cookie
    res.clearCookie('refreshToken', { path: '/' });

    res.status(200).json({ status: 'success', message: 'Logged out from all devices successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ─────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'fail', message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ status: 'success', message: 'If email is registered, you will receive a message' });

    // Generate a unique reset token (NOT an OTP - different from email verification OTP)
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(user.email, resetToken);
      logger.info(`[Password Reset] Email sent to ${user.email}`);
    } catch (emailError) {
      logger.error(`[Password Reset] Failed to send email: ${emailError.message}`);
      user.passwordResetToken = undefined;
      user.passwordResetExpiry = undefined;
      await user.save({ validateBeforeSave: false });
      throw emailError;
    }

    res.status(200).json({ status: 'success', message: 'If email is registered, you will receive a message' });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ──────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ status: 'fail', message: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ status: 'fail', message: 'Link is invalid or expired' });

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    // Revoke all old refresh tokens after password reset
    await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

    const newToken = signToken(user._id, user.tokenVersion);
    const newRefreshToken = signRefreshToken(user._id, user.tokenVersion);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: RefreshToken.hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Set HTTP-only cookie with refresh token
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully',
      token: newToken,
    });
  } catch (err) {
    next(err);
  }
};

// NOTE: getMe endpoint moved to user.controller.js for better organization
// See src/controllers/user.controller.js


