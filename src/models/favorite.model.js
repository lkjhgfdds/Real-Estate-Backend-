const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'userId',
    },
    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      alias: 'propertyId',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

favoriteSchema.index({ user_id: 1, property_id: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
