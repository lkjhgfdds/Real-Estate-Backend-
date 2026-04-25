const ViewingRequest = require('../../models/viewingRequest.model');
const Property       = require('../../models/property.model');
const { createNotification } = require('../../utils/notificationHelper');
const { sendViewingResponseEmail } = require('../../services/email.service');
const logger = require('../../utils/logger');

exports.createViewingRequest = async (req, res, next) => {
  try {
    const { propertyId, preferredDate, preferredTime, message } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ status: 'fail', message: 'Property not found' });
    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'fail', message: 'You cannot request a viewing for your own property' });
    }

    // Prevent duplication: pending request already exists
    const existing = await ViewingRequest.findOne({
      property:  propertyId,
      requester: req.user._id,
      status:    'pending',
    });
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'You already have a pending viewing request for this property' });
    }

    const viewingRequest = await ViewingRequest.create({
      property: propertyId, requester: req.user._id, owner: property.owner,
      preferredDate, preferredTime, message,
    });

    await viewingRequest.populate([
      { path: 'property',  select: 'title location images' },
      { path: 'owner',     select: 'name email phone' },
    ]);

    // Notify property owner
    await createNotification(req.io, property.owner, {
      type:    'viewing',
      title:   'New viewing request',
      message: `${req.user.name} wants to view your property "${property.title}"`,
      link:    `/viewing-requests/${viewingRequest._id}`,
    }).catch(() => {});

    res.status(201).json({ status: 'success', message: 'Viewing request sent successfully', data: { viewingRequest } });
  } catch (err) {
    next(err);
  }
};

exports.getMyViewingRequests = async (req, res, next) => {
  try {
    const requests = await ViewingRequest.find({ requester: req.user._id })
      .populate('property', 'title location images price').populate('owner', 'name email phone').sort('-createdAt');
    res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
  } catch (err) {
    next(err);
  }
};

exports.getOwnerViewingRequests = async (req, res, next) => {
  try {
    const requests = await ViewingRequest.find({ owner: req.user._id })
      .populate('property', 'title location images price').populate('requester', 'name email phone').sort('-createdAt');
    res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
  } catch (err) {
    next(err);
  }
};

// FIX — Add notification + email for requester on approval or rejection
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Status must be approved or rejected' });
    }

    const viewingRequest = await ViewingRequest.findById(req.params.id).lean()
      .populate('requester', 'email name').populate('property', 'title');
    if (!viewingRequest) return res.status(404).json({ status: 'fail', message: 'Viewing request not found' });
    if (viewingRequest.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'You are not authorized' });
    }

    viewingRequest.status = status;
    await viewingRequest.save();

    // Notify requester
    const notifMsg = status === 'approved'
      ? `تمت الموافقة على طلب معاينة "${viewingRequest.property?.title}"`
      : `تم رفض طلب معاينة "${viewingRequest.property?.title}"`;

    await createNotification(req.io, viewingRequest.requester._id, {
      type:    'viewing',
      title:   status === 'approved' ? 'تمت الموافقة على طلب المعاينة' : 'تم رفض طلب المعاينة',
      message: notifMsg,
      link:    `/viewing-requests/${viewingRequest._id}`,
    }).catch(() => {});

    // إيميل للطالب
    if (viewingRequest.requester?.email) {
      await sendViewingResponseEmail(viewingRequest.requester.email, {
        status,
        propertyTitle: viewingRequest.property?.title,
        preferredDate: viewingRequest.preferredDate,
        preferredTime: viewingRequest.preferredTime,
      }).catch((e) => logger.warn(`[ViewingRequest] Email error: ${e.message}`));
    }

    res.status(200).json({ status: 'success', message: `تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, data: { viewingRequest } });
  } catch (err) {
    next(err);
  }
};

exports.cancelViewingRequest = async (req, res, next) => {
  try {
    const viewingRequest = await ViewingRequest.findById(req.params.id);
    if (!viewingRequest) return res.status(404).json({ status: 'fail', message: 'الطلب غير موجود' });
    if (viewingRequest.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'غير مصرح لك' });
    }
    if (viewingRequest.status !== 'pending') {
      return res.status(400).json({ status: 'fail', message: 'لا يمكن إلغاء طلب تمت معالجته' });
    }
    viewingRequest.status = 'cancelled';
    await viewingRequest.save();
    res.status(200).json({ status: 'success', message: 'تم إلغاء الطلب', data: { viewingRequest } });
  } catch (err) {
    next(err);
  }
};
