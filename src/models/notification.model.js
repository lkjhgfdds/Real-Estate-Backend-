const mongoose = require('mongoose');

// FIX — نموذج جديد للإشعارات — كان ناقصاً كلياً
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['booking', 'payment', 'inquiry', 'viewing', 'auction', 'review', 'system'],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    isRead:  { type: Boolean, default: false },
    // رابط للـ entity المرتبط (عقار، مزاد، حجز...)
    link:    { type: String, default: null },
    // بيانات إضافية
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
