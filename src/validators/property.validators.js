const { body } = require('express-validator');

// ─── Create Property ──────────────────────────────────────────
exports.createPropertySchema = [
  body('title').notEmpty().withMessage('Property title is required')
    .isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters'),
  body('description').notEmpty().withMessage('Property description is required')
    .isLength({ min: 20 }).withMessage('Description is too short (minimum 20 characters)'),
  body('price').notEmpty().withMessage('Property price is required')
    .isFloat({ min: 0 }).withMessage('Price cannot be negative'),
  body('type').notEmpty().withMessage('Property type is required')
    .isIn(['apartment','villa','house','studio','office','shop','land','commercial']).withMessage('Property type is not supported'),
  body('listingType').notEmpty().withMessage('Listing type is required')
    .isIn(['sale','rent']).withMessage('Listing type must be sale or rent'),
  body('location.city').notEmpty().withMessage('City is required'),
  // FIX — Add location.district which was in the model but missing from validator
  body('location.district').notEmpty().withMessage('District is required'),
  body('area').optional().isFloat({ min: 0 }).withMessage('Area cannot be negative'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Number of bedrooms cannot be negative'),
  body('bathrooms').optional().isInt({ min: 0 }).withMessage('Number of bathrooms cannot be negative'),
];

// ─── Update Property ──────────────────────────────────────────
exports.updatePropertySchema = [
  body('title').optional().isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters'),
  body('description').optional().isLength({ min: 20 }).withMessage('Description is too short'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price cannot be negative'),
  body('type').optional().isIn(['apartment','villa','house','studio','office','shop','land','commercial']).withMessage('Property type is not supported'),
  body('listingType').optional().isIn(['sale','rent']).withMessage('Listing type must be sale or rent'),
  body('location.city').optional().notEmpty().withMessage('City cannot be empty'),
  body('location.district').optional().notEmpty().withMessage('District cannot be empty'),
  body('area').optional().isFloat({ min: 0 }).withMessage('Area cannot be negative'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Number of bedrooms cannot be negative'),
  body('bathrooms').optional().isInt({ min: 0 }).withMessage('Number of bathrooms cannot be negative'),
];
