const mongoose = require('mongoose');

// البحث المحفوظ — يُرسل إشعار للمستخدم لما يتوفر عقار يناسب معاييره
const savedSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    filters: {
      type:        { type: String },
      listingType: { type: String },
      city:        { type: String },
      district:    { type: String },
      minPrice:    { type: Number },
      maxPrice:    { type: Number },
      minArea:     { type: Number },
      maxArea:     { type: Number },
      bedrooms:    { type: Number },
      bathrooms:   { type: Number },
    },
    notifyOnMatch: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

savedSearchSchema.index({ userId: 1 });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
