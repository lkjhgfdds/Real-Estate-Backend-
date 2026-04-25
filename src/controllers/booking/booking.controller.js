const Booking  = require('../../models/booking.model');
const Property = require('../../models/property.model');
const { sendBookingConfirmationEmail } = require('../../services/email.service');
const { createNotification } = require('../../utils/notificationHelper');
const logger = require('../../utils/logger');

// ─── Create Booking ──────────────────────────────────────────
exports.createBooking = async (req, res, next) => {
  try {
    const { propertyId, amount, start_date, end_date } = req.body;

    const parsedStart = new Date(start_date);
    const parsedEnd   = new Date(end_date);

    if (parsedStart >= parsedEnd) {
      return res.status(400).json({ status: 'fail', message: 'start_date must be before end_date' });
    }
    if (parsedStart < new Date()) {
      return res.status(400).json({ status: 'fail', message: 'Start date cannot be in the past' });
    }

    // FIX #6 — Check property existence and status before creating booking
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'fail', message: 'Property not found' });
    }
    if (property.status !== 'available') {
      return res.status(400).json({ status: 'fail', message: 'Property is not available for booking right now' });
    }
    if (property.listingType !== 'rent') {
      return res.status(400).json({ status: 'fail', message: 'هذا العقار للبيع وليس للإيجار' });
    }

    // التحقق من عدم وجود تعارض في التواريخ
    const conflict = await Booking.findOne({
      property_id: propertyId,
      status:      { $in: ['pending', 'approved'] },
      start_date:  { $lt: parsedEnd },
      end_date:    { $gt: parsedStart },
    });
    if (conflict) {
      return res.status(409).json({ status: 'fail', message: 'العقار محجوز في هذا النطاق الزمني' });
    }

    const booking = await Booking.create({
      user_id:     req.user._id,
      property_id: propertyId,
      amount,
      start_date:  parsedStart,
      end_date:    parsedEnd,
    });

    // Notify property owner
    await createNotification(req.io, property.owner, {
      type:    'booking',
      title:   'New booking request',
      message: `${req.user.name} requested to book your property "${property.title}"`,
      link:    `/bookings/${booking._id}`,
    });

    res.status(201).json({ status: 'success', message: 'Booking request created successfully', data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Get User Bookings ───────────────────────────────────────
exports.getUserBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user_id: req.user._id })
      .populate('property_id', 'title price location images')
      .sort({ start_date: 1 });
    res.status(200).json({ status: 'success', count: bookings.length, data: { bookings } });
  } catch (err) {
    next(err);
  }
};

// ─── Cancel Booking ──────────────────────────────────────────
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!booking) {
      return res.status(404).json({ status: 'fail', message: 'الحجز غير موجود' });
    }
    // FIX — استخدام status بدل applied
    if (booking.status === 'approved') {
      return res.status(400).json({ status: 'fail', message: 'لا يمكن إلغاء حجز مُعتمد' });
    }
    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({ status: 'fail', message: 'الحجز ملغي أو مرفوض بالفعل' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({ status: 'success', message: 'تم إلغاء الحجز', data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── Get Owner Bookings ──────────────────────────────────────
exports.getOwnerBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // FIX — Use corrected booking service with pagination support
    const { getOwnerBookingsService } = require('../../services/booking.service');
    const result = await getOwnerBookingsService(req.user._id, skip, Number(limit));

    res.status(200).json({
      status: 'success',
      total:  result.total,
      page:   Number(page),
      pages:  result.pages,
      count:  result.bookings.length,
      data:   { bookings: result.bookings }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Approve Booking ─────────────────────────────────────────
exports.approveBooking = async (req, res, next) => {
  try {
    const { approveBookingService } = require('../../services/booking.service');
    // FIX — Pass userId and role to service
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

      // إشعار المستخدم
      await createNotification(req.io, booking.user_id._id || booking.user_id, {
        type:    'booking',
        title:   'تم قبول حجزك',
        message: `تم قبول حجزك للعقار "${populated.property_id.title}"`,
        link:    `/bookings/${booking._id}`,
      });
    } catch (e) {
      logger.warn(`[ApproveBooking] Email/Notification error: ${e.message}`);
    }

    res.status(200).json({ status: 'success', message: 'Booking approved successfully', data: { booking } });
  } catch (err) {
    const code = err.message.includes('Not authorized') ? 403
               : err.message.includes('not found')      ? 404 : 400;
    res.status(code).json({ status: 'fail', message: err.message });
  }
};

// ─── Reject Booking ──────────────────────────────────────────
exports.rejectBooking = async (req, res, next) => {
  try {
    const { rejectBookingService } = require('../../services/booking.service');
    const booking = await rejectBookingService(req.params.id, req.user._id, req.user.role);

    // إشعار المستخدم
    try {
      await createNotification(req.io, booking.user_id, {
        type:    'booking',
        title:   'تم رفض طلب حجزك',
        message: 'للأسف تم رفض طلب حجزك، يمكنك البحث عن عقار آخر',
        link:    '/properties',
      });
    } catch (e) {}

    res.status(200).json({ status: 'success', message: 'Booking rejected successfully', data: { booking } });
  } catch (err) {
    const code = err.message.includes('Not authorized') ? 403
               : err.message.includes('not found')      ? 404 : 400;
    res.status(code).json({ status: 'fail', message: err.message });
  }
};

// ─── Get Single Booking ──────────────────────────────────────
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).lean()
      .populate('property_id', 'title price location images owner')
      .populate('user_id',     'name email phone');

    if (!booking) {
      return res.status(404).json({ status: 'fail', message: 'الحجز غير موجود' });
    }

    const isUser  = booking.user_id._id.toString() === req.user._id.toString();
    const isOwner = booking.property_id?.owner?.toString() === req.user._id.toString();
    if (!isUser && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'غير مصرح لك' });
    }

    res.status(200).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};
