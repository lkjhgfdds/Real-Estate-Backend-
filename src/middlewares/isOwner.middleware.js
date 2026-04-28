const Property = require('../models/property.model');
const Booking  = require('../models/booking.model');

exports.isOwner = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'fail', message: req.t('COMMON.LOGIN_REQUIRED') });

    if (!req.user.isActive) return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_SUSPENDED') });
    if (req.user.isBanned) return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_BANNED') });

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ status: 'fail', message: req.t('PROPERTY.NOT_FOUND') });

    if (req.user.role === 'admin') { 
      req.property = property; 
      return next(); 
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: req.t('PROPERTY.NOT_OWNER') });
    }

    req.property = property;
    next();
  } catch (err) {
    next(err);
  }
};

exports.isBookingPropertyOwner = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'fail', message: req.t('COMMON.LOGIN_REQUIRED') });

    if (!req.user.isActive) return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_SUSPENDED') });
    if (req.user.isBanned) return res.status(403).json({ status: 'fail', message: req.t('COMMON.ACCOUNT_BANNED') });

    const booking = await Booking.findById(req.params.id).populate('property_id', 'owner title');
    if (!booking) return res.status(404).json({ status: 'fail', message: req.t('BOOKING.NOT_FOUND') });
    if (!booking.property_id?.owner) return res.status(400).json({ status: 'fail', message: req.t('DASHBOARD.INCOMPLETE_BOOKING') });

    if (req.user.role === 'admin') { 
      req.booking = booking; 
      return next(); 
    }

    if (booking.property_id.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: req.t('COMMON.NO_PERMISSION') });
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
};