const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { uploadGenericImage } = require('../middlewares/upload.middleware');

/**
 * @swagger
 * /upload:
 *   post:
 *     tags: [📁 Upload]
 *     summary: Upload a single image
 *     description: Uploads an image to Cloudinary and returns the secure URL.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 url: { type: string }
 *       401:
 *         description: Unauthorized
 */

// We use protect because usually only authenticated users should upload
router.post('/', protect, uploadGenericImage, (req, res) => {
  // The uploadSingleImage middleware puts the URL in req.body.photo
  // but let's make sure it handles the field name 'image' or 'photo'
  
  const url = req.body.photo || (req.body.images && req.body.images[0]);
  
  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'No image uploaded or upload failed'
    });
  }

  res.status(200).json({
    success: true,
    url: url
  });
});

module.exports = router;
