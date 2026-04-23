const Booking  = require('../models/booking.model');
const Property = require('../models/property.model');

// FIX — Check authorization: userId and role are required
const approveBookingService = async (bookingId, userId, role) => {
  const booking = await Booking.findById(bookingId).populate('property_id');
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'rejected') throw new Error('Cannot accept a rejected booking');
  if (booking.status === 'approved') throw new Error('Booking is already approved');
  if (booking.status === 'cancelled') throw new Error('Cannot accept a cancelled booking');

  // FIX — Check that user is the property owner
  const isOwner = booking.property_id?.owner?.toString() === userId?.toString();
  if (role !== 'admin' && !isOwner) {
    throw new Error('Not authorized — you are not the owner of this property');
  }

  booking.status = 'approved';
  await booking.save();
  return booking;
};

const rejectBookingService = async (bookingId, userId, role) => {
  const booking = await Booking.findById(bookingId).populate('property_id');
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Cannot reject a cancelled booking');

  const isOwner = booking.property_id?.owner?.toString() === userId?.toString();
  if (role !== 'admin' && !isOwner) {
    throw new Error('Not authorized — you are not the owner of this property');
  }

  booking.status = 'rejected';
  await booking.save();
  return booking;
};

// FIX — Use MongoDB query with pagination to improve performance with many bookings
const getOwnerBookingsService = async (ownerId, skip = 0, limit = 20) => {
  const properties = await Property.find({ owner: ownerId }).select('_id');
  const propertyIds = properties.map((p) => p._id);

  const [bookings, total] = await Promise.all([
    Booking.find({ property_id: { $in: propertyIds } })
      .populate('property_id', 'title price location images')
      .populate('user_id',     'name email phone')
      .sort('-created_at')
      .skip(skip)
      .limit(limit),
    Booking.countDocuments({ property_id: { $in: propertyIds } }),
  ]);

  return {
    bookings,
    total,
    skip,
    limit,
    pages: Math.ceil(total / limit),
  };
};

module.exports = { approveBookingService, rejectBookingService, getOwnerBookingsService };
