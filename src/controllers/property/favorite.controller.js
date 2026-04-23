const Favorite = require('../../models/favorite.model');
const Property = require('../../models/property.model');

exports.addFavorite = async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Property not found' });

    const favorite = await Favorite.create({ user_id: req.user._id, property_id: propertyId });
    await favorite.populate('property_id', 'title price location images avgRating');

    res.status(201).json({ status: 'success', message: 'Added to favorites successfully', data: { favorite } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: 'fail', message: 'Property already in favorites' });
    }
    next(err);
  }
};

exports.getFavorites = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const total     = await Favorite.countDocuments({ user_id: req.user._id });
    const favorites = await Favorite.find({ user_id: req.user._id })
      .populate('property_id', 'title price location images avgRating status')
      .limit(limit).skip(skip).sort({ created_at: -1 });

    res.status(200).json({ status: 'success', count: favorites.length, total, page, pages: Math.ceil(total / limit), data: { favorites } });
  } catch (err) {
    next(err);
  }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const deleted = await Favorite.findOneAndDelete({
      user_id:     req.user._id,
      property_id: req.params.propertyId,
    });
    if (!deleted) return res.status(404).json({ status: 'fail', message: 'Property not found in favorites' });
    res.status(200).json({ status: 'success', message: 'Removed from favorites successfully' });
  } catch (err) {
    next(err);
  }
};
