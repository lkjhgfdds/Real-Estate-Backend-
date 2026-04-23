const Property = require('../models/property.model');
const Booking  = require('../models/booking.model');

exports.isOwner = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'fail', message: 'You must be logged in' });

    if (!req.user.isActive) return res.status(403).json({ status: 'fail', message: 'Account is suspended' });
    if (req.user.isBanned) return res.status(403).json({ status: 'fail', message: 'Account is banned' });

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Property not found' });

    if (req.user.role === 'admin') { 
      req.property = property; 
      return next(); 
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'You do not have permission — not the owner of this property' });
    }

    req.property = property;
    next();
  } catch (err) {
    next(err);
  }
};

exports.isBookingPropertyOwner = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'fail', message: 'You must be logged in' });

    if (!req.user.isActive) return res.status(403).json({ status: 'fail', message: 'Account is suspended' });
    if (req.user.isBanned) return res.status(403).json({ status: 'fail', message: 'Account is banned' });

    const booking = await Booking.findById(req.params.id).populate('property_id', 'owner title');
    if (!booking) return res.status(404).json({ status: 'fail', message: 'Booking not found' });
    if (!booking.property_id?.owner) return res.status(400).json({ status: 'fail', message: 'Incomplete booking data' });

    if (req.user.role === 'admin') { 
      req.booking = booking; 
      return next(); 
    }

    if (booking.property_id.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'You do not have permission' });
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
};