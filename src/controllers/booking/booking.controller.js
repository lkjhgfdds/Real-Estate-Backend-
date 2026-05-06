const Booking  = require('../../models/booking.model');
const Property = require('../../models/property.model');
const { sendBookingConfirmationEmail } = require('../../services/email.service');
const { createNotification } = require('../../utils/notificationHelper');
const logger = require('../../utils/logger');
const AuditLog = require('../../models/auditLog.model');

// ─── Create Booking (Unified: rent + sale) ────────────────────
exports.createBooking = async (req, res, next) => {
  try {
    const { propertyId, bookingType, start_date, end_date, offerPrice, notes } = req.body;

    // Validate property exists and is available
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'fail', message: req.t('PROPERTY.NOT_FOUND') });
    }
    if (property.status !== 'available') {
      return res.status(400).json({ status: 'fail', message: req.t('PROPERTY.NOT_AVAILABLE') });
    }

    // Resolve booking type from property if not provided
    const expectedType = property.listingType === 'rent' ? 'rent' : 'sale';
    if (bookingType && bookingType !== expectedType) {
      return res.status(400).json({
        status: 'fail',
        message: `This property is for ${expectedType}. Booking type must be '${expectedType}'.`,
      });
    }
    const resolvedType = bookingType || expectedType;

    let bookingData = {
      user_id: req.user._id,
      property_id: propertyId,
      bookingType: resolvedType,
      notes,
    };

    if (resolvedType === 'rent') {
      // ── RENT: Validate dates ──────────────────────────────────
      if (!start_date || !end_date) {
        return res.status(400).json({
          status: 'fail',
          message: 'Check-in and check-out dates are required for rental bookings.',
        });
      }
      const parsedStart = new Date(start_date);
      const parsedEnd   = new Date(end_date);

      if (parsedStart >= parsedEnd) {
        return res.status(400).json({ status: 'fail', message: req.t('BOOKING.START_BEFORE_END') });
      }
      if (parsedStart < new Date()) {
        return res.status(400).json({ status: 'fail', message: req.t('BOOKING.START_NOT_PAST') });
      }

      // ── CRITICAL: Atomic date conflict lock ──────────────────
      // Prevents double-booking same property for overlapping dates
      const conflict = await Booking.findOne({
        property_id: propertyId,
        bookingType:  'rent',
        status:       { $in: ['pending', 'approved'] },
        start_date:   { $lt: parsedEnd },
        end_date:     { $gt: parsedStart },
      });
      if (conflict) {
        return res.status(409).json({
          status: 'fail',
          message: req.t('BOOKING.DATE_CONFLICT'),
          conflictingDates: { start: conflict.start_date, end: conflict.end_date },
        });
      }

      // Server-calculated amount (price per night × nights)
      const nights = Math.ceil((parsedEnd - parsedStart) / (1000 * 60 * 60 * 24));
      bookingData.start_date = parsedStart;
      bookingData.end_date   = parsedEnd;
      bookingData.amount     = property.price * nights;

    } else {
      // ── SALE: Make an offer ───────────────────────────────────
      if (!offerPrice || offerPrice <= 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Offer price is required for sale bookings and must be positive.',
        });
      }
      bookingData.offerPrice = offerPrice;
      bookingData.amount     = property.price; // Listed price (offer is separate)
    }

    const booking = await Booking.create(bookingData);

    // Notify property owner
    const eventTitle = resolvedType === 'rent'
      ? `New rental request from ${req.user.name}`
      : `New purchase offer from ${req.user.name}`;

    await createNotification(req.io, property.owner, {
      type:    'booking',
      title:   eventTitle,
      message: `For property: ${property.title}`,
      link:    `/dashboard/owner-bookings`,
    });

    logger.info(`[BOOKING] User ${req.user._id} created ${resolvedType} booking for property ${propertyId}`);
    res.status(201).json({ status: 'success', message: req.t('BOOKING.CREATED'), data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Get User Bookings ───────────────────────────────────────
exports.getUserBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, bookingType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { user_id: req.user._id };
    if (status && status !== 'all') filter.status = status;
    if (bookingType) filter.bookingType = bookingType;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('property_id', 'title price location images listingType')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Booking.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: bookings.length,
      data: { bookings },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cancel Booking (Payment-Aware) ─────────────────────────
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property_id');
    if (!booking) {
      return res.status(404).json({ status: 'fail', message: req.t('BOOKING.NOT_FOUND') });
    }

    const isBuyer = booking.user_id.toString() === req.user._id.toString();
    const isOwner = booking.property_id && booking.property_id.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBuyer && !isOwner && !isAdmin) {
      return res.status(403).json({ status: 'fail', message: req.t('COMMON.NOT_AUTHORIZED') });
    }

    if (booking.status === 'cancelled' || booking.status === 'rejected' || booking.status === 'completed') {
      return res.status(400).json({ status: 'fail', message: req.t('BOOKING.ALREADY_PROCESSED') });
    }

    // ── HARD RULE: Matrix Validation ──
    if (booking.paymentStatus === 'paid' && !isAdmin) {
      return res.status(400).json({
        status: 'fail',
        code: 'CANNOT_CANCEL_PAID',
        message: 'Cannot cancel a booking that has already been paid. Please contact support for a refund.',
      });
    }

    if (isOwner && !isAdmin && booking.status === 'pending') {
      return res.status(400).json({
        status: 'fail',
        message: 'Owners must use the reject endpoint for pending bookings.',
      });
    }

    const reason = req.body.reason || 'No reason provided';
    
    // ── Apply Cancellation ──
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user._id;
    booking.cancelReason = reason;

    booking.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user._id,
      changedAt: new Date(),
      reason,
    });
    booking.lastActionBy = req.user._id;
    booking.lastActionAt = new Date();
    
    await booking.save();

    // ── Patch: Property Status Race Condition ──
    if (booking.property_id) {
      const otherActiveBooking = await Booking.findOne({
        _id: { $ne: booking._id },
        property_id: booking.property_id._id,
        status: { $in: ['pending', 'approved', 'completed'] }
      });

      if (!otherActiveBooking) {
        await Property.findByIdAndUpdate(booking.property_id._id, {
          status: 'available',
        });
        logger.info(`[BOOKING] Property ${booking.property_id._id} reverted to AVAILABLE`);
      }
    }

    // ── Audit Log ──
    await AuditLog.create({
      actor: req.user._id,
      action: isAdmin ? 'ADMIN_CANCEL_BOOKING' : 'CANCEL_BOOKING',
      targetType: 'Booking',
      targetId: booking._id,
      changes: {
        before: { status: booking.statusHistory.length > 1 ? booking.statusHistory[booking.statusHistory.length - 2].status : 'unknown' },
        after: { status: 'cancelled' }
      },
      metadata: { reason, role: req.user.role }
    });

    logger.info(`[BOOKING] Booking ${booking._id} cancelled by ${req.user.role} ${req.user._id}. Reason: ${reason}`);
    
    res.status(200).json({ status: 'success', message: req.t('BOOKING.CANCELLED'), data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Get Owner Bookings ──────────────────────────────────────
exports.getOwnerBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const { getOwnerBookingsService } = require('../../services/booking.service');
    const result = await getOwnerBookingsService(req.user._id, skip, Number(limit));

    res.status(200).json({
      status: 'success',
      total:  result.total,
      page:   Number(page),
      pages:  result.pages,
      count:  result.bookings.length,
      data:   { bookings: result.bookings },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Approve Booking ─────────────────────────────────────────
exports.approveBooking = async (req, res, next) => {
  try {
    const { approveBookingService } = require('../../services/booking.service');
    const booking = await approveBookingService(req.params.id, req.user._id, req.user.role);

    // Send email to user
    try {
      const populated = await booking.populate([
        { path: 'user_id',     select: 'email name' },
        { path: 'property_id', select: 'title' },
      ]);
      await sendBookingConfirmationEmail(populated.user_id.email, {
        propertyTitle: populated.property_id.title,
        startDate:     booking.start_date,
        endDate:       booking.end_date,
        amount:        booking.amount,
      });

      // Notify buyer to proceed with payment
      await createNotification(req.io, booking.user_id._id || booking.user_id, {
        type:    'booking',
        title:   '✅ Booking Approved — Pay Now!',
        message: `Your booking for "${populated.property_id.title}" has been approved. Click to complete payment.`,
        link:    `/dashboard/bookings`,
      });
    } catch (e) {
      logger.warn('[BOOKING] Notification/Email Error after approval:', e.message);
    }

    res.status(200).json({ status: 'success', message: req.t('BOOKING.APPROVED'), data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Reject Booking ──────────────────────────────────────────
exports.rejectBooking = async (req, res, next) => {
  try {
    const { rejectBookingService } = require('../../services/booking.service');
    const booking = await rejectBookingService(req.params.id, req.user._id, req.user.role);

    try {
      await createNotification(req.io, booking.user_id, {
        type:    'booking',
        title:   '❌ Booking Request Declined',
        message: req.t('NOTIFICATION.BOOKING_REJECTED_MSG'),
        link:    '/properties',
      });
    } catch (e) {}

    res.status(200).json({ status: 'success', message: req.t('BOOKING.REJECTED'), data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Get Single Booking ──────────────────────────────────────
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).lean()
      .populate('property_id', 'title price location images owner listingType')
      .populate('user_id',     'name email phone');

    if (!booking) {
      return res.status(404).json({ status: 'fail', message: req.t('BOOKING.NOT_FOUND') });
    }

    const isUser  = booking.user_id._id.toString() === req.user._id.toString();
    const isOwner = booking.property_id?.owner?.toString() === req.user._id.toString();
    if (!isUser && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: req.t('COMMON.NOT_AUTHORIZED') });
    }

    res.status(200).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Bulk Update Status ──────────────────────────────────────
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { bookingIds, status } = req.body;
    if (!bookingIds || !Array.isArray(bookingIds) || !status) {
      return res.status(400).json({ status: 'fail', message: 'Booking IDs array and status are required' });
    }

    const { bulkUpdateStatusService } = require('../../services/booking.service');
    const updated = await bulkUpdateStatusService(bookingIds, status, req.user._id);

    res.status(200).json({
      status: 'success',
      message: `Successfully updated ${updated.length} bookings to ${status}`,
      count: updated.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Export Bookings to CSV ──────────────────────────────────
exports.exportBookings = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const User     = require('../../models/user.model');
      const Property = require('../../models/property.model');

      const [users, properties] = await Promise.all([
        User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).select('_id'),
        Property.find({ title: searchRegex }).select('_id'),
      ]);
      filter.$or = [
        { user_id:     { $in: users.map(u => u._id) } },
        { property_id: { $in: properties.map(p => p._id) } },
      ];
    }

    const bookings = await Booking.find(filter)
      .populate('user_id',     'name email')
      .populate('property_id', 'title price')
      .sort('-created_at')
      .lean();

    let csv = 'Booking ID,Type,Client,Email,Property,Amount,Status,Payment Status,Date\n';
    bookings.forEach(b => {
      csv += `${b._id},${b.bookingType || 'rent'},${b.user_id?.name || 'N/A'},${b.user_id?.email || 'N/A'},${b.property_id?.title || 'N/A'},${b.amount},${b.status},${b.paymentStatus},${b.created_at?.toISOString() || 'N/A'}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-export-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
