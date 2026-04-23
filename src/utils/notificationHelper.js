const Notification = require('../models/notification.model');
const logger = require('./logger');

/**
 * إنشاء إشعار وإرساله عبر Socket.IO
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - ID المستخدم المستلم
 * @param {Object} data - بيانات الإشعار
 */
const createNotification = async (io, userId, { type, title, message, link = null, meta = {} }) => {
  try {
    const notif = await Notification.create({ userId, type, title, message, link, meta });
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        _id:       notif._id,
        type,
        title,
        message,
        link,
        isRead:    false,
        createdAt: notif.createdAt,
      });
    }
    return notif;
  } catch (err) {
    logger.error(`[Notification] Failed to create notification: ${err.message}`);
  }
};

module.exports = { createNotification };
