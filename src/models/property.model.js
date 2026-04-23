const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'عنوان العقار مطلوب'],
      trim: true,
      minlength: [10, 'العنوان قصير جداً (10 حروف على الأقل)'],
      maxlength: [100, 'العنوان طويل جداً (بحد أقصى 100 حرف)'],
    },
    description: {
      type: String,
      required: [true, 'وصف العقار مطلوب'],
      minlength: [20, 'الوصف قصير جداً'],
    },
    price: {
      type: Number,
      required: [true, 'سعر العقار مطلوب'],
      min: [0, 'Price cannot be negative'],
    },
    type: {
      type: String,
      required: [true, 'Property type is required'],
      enum: {
        values: ['apartment', 'villa', 'house', 'studio', 'office', 'shop', 'land', 'commercial'],
        message: '{VALUE} type is not supported currently',
      },
    },
    listingType: {
      type: String,
      enum: { values: ['sale', 'rent'], message: 'Value must be sale or rent' },
      default: 'sale',
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold'],
      default: 'available',
    },
    location: {
      city:     { type: String, required: [true, 'City is required'] },
      district: { type: String, required: [true, 'District is required'] },
      street:   { type: String },
    },
    area:      { type: Number, min: [0, 'Area cannot be negative'] },
    bedrooms:  { type: Number, default: 0, min: 0 },
    bathrooms: { type: Number, default: 0, min: 0 },
    images:    { type: [String], default: [] },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Property must belong to a user'],
    },
    avgRating: {
      type: Number,
      default: 0,
      min: [0, 'أقل تقييم هو 0'],
      max: [5, 'أعلى تقييم هو 5'],
      set: (val) => Math.round(val * 10) / 10,
    },
    reviewCount: { type: Number, default: 0 },
    isApproved:  { type: Boolean, default: false }, // العقار يحتاج موافقة الأدمن قبل النشر
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for query performance
propertySchema.index({ price: 1 });
propertySchema.index({ type: 1 });
propertySchema.index({ listingType: 1 });
propertySchema.index({ 'location.city': 1 });
propertySchema.index({ owner: 1 });
propertySchema.index({ status: 1 });

// FIX — إضافة Text Index للبحث الكفء بدل $regex البطيء
propertySchema.index(
  { title: 'text', description: 'text', 'location.city': 'text', 'location.district': 'text' },
  { weights: { title: 10, 'location.city': 5, 'location.district': 5, description: 1 } }
);

// Virtual populate for reviews
propertySchema.virtual('reviews', {
  ref:          'Review',
  foreignField: 'propertyId',
  localField:   '_id',
});

module.exports = mongoose.model('Property', propertySchema);
