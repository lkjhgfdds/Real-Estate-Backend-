const mongoose = require('mongoose');

// نموذج البلاغات — لإبلاغ عن عقارات أو مستخدمين مخالفين
const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['property', 'user', 'review', 'inquiry'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType',
    },
    reason: {
      type: String,
      enum: ['spam', 'fraud', 'inappropriate', 'wrong_info', 'duplicate', 'other'],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
    adminNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);
