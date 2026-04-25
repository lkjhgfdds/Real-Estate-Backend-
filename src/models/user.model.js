const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },

    phone:{ type: String, default: null },
    role: {
      type: String,
      enum: { values: ['buyer', 'owner', 'agent', 'admin'], message: 'Invalid role' },
      default: 'buyer',
    },
    photo: { type: String, default: null },
    bio: { type: String, default: '' },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },

    //  Security
    passwordChangedAt: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 }, // logout all

    //  OTP (Email Verification / Reset)
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },

    //  Password Reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },

    //  Login Protection
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    //  KYC / Identity Verification
    kycStatus: {
      type: String,
      enum: { values: ['not_submitted', 'pending', 'approved', 'rejected'], message: 'Invalid KYC status' },
      default: 'not_submitted',
      index: true,
    },
    kycDocuments: [
      {
        type: {
          type: String,
          enum: ['national_id', 'passport', 'drivers_license'],
          required: true,
        },
        frontImage: {
          type: String,  // Cloudinary signed URL
          required: true,
        },
        backImage: String,  // Optional for some document types
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    kycSubmittedAt: { type: Date, select: false },
    kycVerifiedAt: { type: Date, select: false },
    kycApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,
    },
    kycApprovedAt: { type: Date, select: false },
    kycRejectionReason: { type: String, select: false },
    kycAttempts: { type: Number, default: 0, select: false },

    //  Bank Accounts (for receiving/paying)
    bankAccounts: [
      {
        ibanEncrypted: {
          type: String,  // AES-256 encrypted IBAN
          select: false,
        },
        ibanLast4: String,  // Last 4 digits for display (non-sensitive)
        accountHolderName: String,
        bankName: String,
        isDefault: { type: Boolean, default: false },
        encryptionTag: String,  // Unique salt per account
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Indexes
// Note: email index is created automatically by unique: true
userSchema.index({ isActive: 1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ kycSubmittedAt: 1 });


//  Hash Password

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
    this.tokenVersion += 1; // invalidate tokens
  }
});


//  Compare Password

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};


//  OTP Generator

userSchema.methods.createOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const hash = crypto.createHash('sha256').update(otp).digest('hex');

  this.otpHash = hash;
  this.otpExpires = Date.now() + 10 * 60 * 1000; // 10 min
  this.otpAttempts = 0;

  return otp;
};


//  Verify OTP

userSchema.methods.verifyOTP = function (enteredOtp) {
  const hash = crypto.createHash('sha256').update(enteredOtp).digest('hex');

  if (this.otpExpires < Date.now()) return false;

  if (this.otpAttempts >= 5) return false;

  if (hash !== this.otpHash) {
    this.otpAttempts += 1;
    return false;
  }

  // success
  this.otpHash = undefined;
  this.otpExpires = undefined;
  this.otpAttempts = 0;

  return true;
};


//  Account Lock Check

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};


//  Handle Failed Login

userSchema.methods.incLoginAttempts = function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;

    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 15 * 60 * 1000; // 15 min
    }
  }
};

module.exports = mongoose.model('User', userSchema);
