const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    isRevoked: {
      type: Boolean,
      default: false,
    },

    revokedAt: Date,

    // Token Rotation
    replacedByToken: String,

    // Device Info
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

// TTL index: expire documents after expiresAt
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Static Methods ────────────────────────────────────────

// Hash token for storage
refreshTokenSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate and save new token
refreshTokenSchema.statics.generateToken = async function (userId, options = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = this.hashToken(token);

  const refreshToken = await this.create({
    userId,
    tokenHash: hashedToken,
    expiresAt: options.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    userAgent: options.userAgent || '',
    ip: options.ip || '',
  });

  return token;
};

// ─── Instance Methods ──────────────────────────────────────

// Revoke token and optionally replace it
refreshTokenSchema.methods.revoke = function (replacementToken) {
  this.isRevoked = true;
  this.revokedAt = new Date();

  if (replacementToken) {
    this.replacedByToken = replacementToken;
  }
};

refreshTokenSchema.methods.isActive = function () {
  return !this.isRevoked && this.expiresAt > new Date();
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);