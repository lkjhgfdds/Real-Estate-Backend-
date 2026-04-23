const multer  = require('multer');
const path    = require('path');
const cloudinary = require('../config/cloudinary');
const AppError   = require('../utils/AppError');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE       = 5 * 1024 * 1024; // 5MB

const storage    = multer.memoryStorage();
const fileFilter = (_req, file, cb) => {
  const ext    = path.extname(file.originalname).toLowerCase();
  const mimeOk = file.mimetype.startsWith('image/');
  const extOk  = ALLOWED_EXTENSIONS.includes(ext);
  if (mimeOk && extOk) return cb(null, true);
  cb(new AppError(`File type not allowed — Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`, 400), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 10 } });

const uploadToCloudinary = (buffer, folder = 'real-estate') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error) return reject(new AppError('Failed to upload image to Cloudinary', 500));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });

const handleMulterError = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')  return next(new AppError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400));
    if (err.code === 'LIMIT_FILE_COUNT') return next(new AppError('Number of files exceeds 10 images', 400));
    next(err);
  });
};

// FIX — uploadImagesToCloud puts URLs in req.body so controllers can use them
const uploadImagesToCloud = async (req, _res, next) => {
  try {
    if (req.files && req.files.length > 0) {
      req.body.images = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, 'real-estate/properties'))
      );
    }
    if (req.file) {
      req.body.photo = await uploadToCloudinary(req.file.buffer, 'real-estate/avatars');
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadPropertyImages: [handleMulterError(upload.array('images', 10)), uploadImagesToCloud],
  uploadSingleImage:    [handleMulterError(upload.single('photo')),     uploadImagesToCloud],
};
