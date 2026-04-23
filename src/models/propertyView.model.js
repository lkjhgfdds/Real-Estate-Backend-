const mongoose = require('mongoose');

// تتبع مشاهدات العقارات لإحصاءات دقيقة
const propertyViewSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    viewer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ip:       { type: String },
    userAgent:{ type: String },
    source:   { type: String, enum: ['web', 'mobile', 'api'], default: 'web' },
  },
  { timestamps: { createdAt: 'viewedAt', updatedAt: false } }
);

propertyViewSchema.index({ property: 1, viewedAt: -1 });
propertyViewSchema.index({ viewer: 1 });
// Auto-delete views after 90 days
propertyViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('PropertyView', propertyViewSchema);
