const mongoose = require('mongoose');
const Payment  = require('../../models/payment.model');
const Booking  = require('../../models/booking.model');
const { PAYMENT_STATUS } = require('../../utils/constants');
const { v4: uuidv4 } = require('uuid');

// FIX — Use PAYMENT_STATUS constants to avoid enum mismatches

exports.createPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { bookingId, amount, method } = req.body;

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: 'Booking not found' });
    }

    if (booking.user_id.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ status: 'fail', message: 'You are not authorized to pay for this booking' });
    }

    if (booking.status !== 'approved') {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: 'Booking must be approved before payment' });
    }

    // FIX — Use PAYMENT_STATUS.PAID constant instead of hardcoded 'paid'
    const existingPayment = await Payment.findOne({ booking_id: bookingId, status: PAYMENT_STATUS.PAID }).session(session);
    if (existingPayment) {
      await session.abortTransaction();
      return res.status(409).json({ status: 'fail', message: 'This booking is already paid' });
    }

    const payment = await Payment.create(
      [{
        user_id:       req.user._id,
        booking_id:    bookingId,
        amount:        amount || booking.amount,
        method:        method || 'cash',
        transactionId: uuidv4(),
        status:        'pending',
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ status: 'success', message: 'Payment created successfully', data: { payment: payment[0] } });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    // FIX — Use correct values (paid instead of completed)
    const valid = ['pending', 'paid', 'failed', 'refunded'];
    if (!valid.includes(status)) {
      return res.status(400).json({ status: 'fail', message: `Status must be one of: ${valid.join(', ')}` });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ status: 'fail', message: 'Payment not found' });
    }

    if (payment.user_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'You are not authorized' });
    }

    payment.status = status;
    if (status === 'paid') payment.paidAt = new Date();
    await payment.save();

    res.status(200).json({ status: 'success', message: 'Payment status updated successfully', data: { payment } });
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ status: 'fail', message: 'Payment not found' });
    }
    if (payment.status === 'paid') {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete a completed payment' });
    }
    if (payment.user_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'You are not authorized' });
    }
    await payment.deleteOne();
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

exports.getUserPayments = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const total    = await Payment.countDocuments({ user_id: req.user._id });
    const payments = await Payment.find({ user_id: req.user._id })
      .populate('booking_id', 'start_date end_date amount property_id')
      .sort('-createdAt').skip(skip).limit(limit);

    res.status(200).json({ status: 'success', results: payments.length, total, page, pages: Math.ceil(total / limit), data: { payments } });
  } catch (err) {
    next(err);
  }
};

exports.getAllPayments = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const total    = await Payment.countDocuments();
    const payments = await Payment.find()
      .populate('user_id',    'name email')
      .populate('booking_id', 'start_date end_date amount property_id')
      .sort('-createdAt').skip(skip).limit(limit);

    res.status(200).json({ status: 'success', results: payments.length, total, page, pages: Math.ceil(total / limit), data: { payments } });
  } catch (err) {
    next(err);
  }
};
