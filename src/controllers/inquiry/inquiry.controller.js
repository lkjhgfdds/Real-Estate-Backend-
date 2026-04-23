const Inquiry  = require('../../models/inquiry.model');
const Property = require('../../models/property.model');
const { createNotification } = require('../../utils/notificationHelper');

exports.sendInquiry = async (req, res, next) => {
  try {
    const { propertyId, message } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Property not found' });
    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'fail', message: 'You cannot send an inquiry about your own property' });
    }

    const inquiry = await Inquiry.create({
      sender:   req.user._id,
      receiver: property.owner,
      property: propertyId,
      content:  message,
    });

    await inquiry.populate([
      { path: 'sender',   select: 'name email photo' },
      { path: 'property', select: 'title price location' },
    ]);

    // Notify property owner
    await createNotification(req.io, property.owner, {
      type:    'inquiry',
      title:   'New inquiry',
      message: `${req.user.name} sent an inquiry about your property "${property.title}"`,
      link:    `/inquiries/${inquiry._id}`,
    }).catch(() => {});

    res.status(201).json({ status: 'success', message: 'Inquiry sent successfully', data: { inquiry } });
  } catch (err) {
    next(err);
  }
};

exports.getInquiriesByProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Property not found' });
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    const inquiries = await Inquiry.find({ property: req.params.propertyId })
      .populate('sender', 'name email photo').sort('-createdAt');
    res.status(200).json({ status: 'success', results: inquiries.length, data: { inquiries } });
  } catch (err) {
    next(err);
  }
};

exports.getMyInbox = async (req, res, next) => {
  try {
    const inquiries = await Inquiry.find({ receiver: req.user._id })
      .populate('sender',   'name email photo')
      .populate('property', 'title price location images').sort('-createdAt');
    res.status(200).json({ status: 'success', results: inquiries.length, data: { inquiries } });
  } catch (err) {
    next(err);
  }
};

exports.getMySentInquiries = async (req, res, next) => {
  try {
    const inquiries = await Inquiry.find({ sender: req.user._id })
      .populate('receiver', 'name email')
      .populate('property', 'title price location images').sort('-createdAt');
    res.status(200).json({ status: 'success', results: inquiries.length, data: { inquiries } });
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ status: 'fail', message: 'Inquiry not found' });
    if (inquiry.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    inquiry.isRead = true;
    await inquiry.save();
    res.status(200).json({ status: 'success', message: 'Marked as read successfully', data: { inquiry } });
  } catch (err) {
    next(err);
  }
};

// FIX — Add reply mechanism
exports.replyToInquiry = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ status: 'fail', message: 'Message is required' });

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ status: 'fail', message: 'Inquiry not found' });
    if (inquiry.receiver.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }

    inquiry.replies = inquiry.replies || [];
    inquiry.replies.push({ from: req.user._id, message, createdAt: new Date() });
    inquiry.isRead = true;
    await inquiry.save();

    // Notify sender
    await createNotification(req.io, inquiry.sender, {
      type:    'inquiry',
      title:   'Reply to your inquiry',
      message: 'You received a reply to your inquiry',
      link:    `/inquiries/${inquiry._id}`,
    }).catch(() => {});

    res.status(200).json({ status: 'success', message: 'Reply sent successfully', data: { inquiry } });
  } catch (err) {
    next(err);
  }
};

exports.deleteInquiry = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ status: 'fail', message: 'Inquiry not found' });
    if (inquiry.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    await inquiry.deleteOne();
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};
