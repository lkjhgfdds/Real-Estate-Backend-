const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property is required'],
      alias: 'property_id',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      alias: 'user_id',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

// One review per user per property
reviewSchema.index({ propertyId: 1, userId: 1 }, { unique: true });

// Static method to update property avgRating after save
reviewSchema.statics.calcAverageRatings = async function (propertyId) {
  const stats = await this.aggregate([
    { $match: { propertyId } },
    {
      $group: {
        _id: '$propertyId',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await mongoose.model('Property').findByIdAndUpdate(propertyId, {
      reviewCount: stats[0].nRating,
      avgRating: stats[0].avgRating,
    });
  } else {
    await mongoose.model('Property').findByIdAndUpdate(propertyId, {
      reviewCount: 0,
      avgRating: 0,
    });
  }
};

reviewSchema.post('save', function () {
  this.constructor.calcAverageRatings(this.propertyId);
});

reviewSchema.post('deleteOne', { document: true }, function () {
  this.constructor.calcAverageRatings(this.propertyId);
});

module.exports = mongoose.model('Review', reviewSchema);
