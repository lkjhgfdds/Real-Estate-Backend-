let _io = null;

/**
 * تخزين instance الـ socket.io
 */
exports.init = (io) => {
  _io = io;
};

/**
 * استرجاع instance الـ socket.io
 */
exports.getIO = () => {
  if (!_io) {
    throw new Error('Socket.io لم يتم تهيئته بعد');
  }
  return _io;
};
