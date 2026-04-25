const { body } = require('express-validator');

exports.registerSchema = [
  body('name').notEmpty().withMessage('Name is required')
    .isLength({ min: 3, max: 50 }).withMessage('Name must be between 3 and 50 characters'),
  body('email').notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').optional()
    .matches(/^[0-9+\-\s]{7,15}$/).withMessage('Invalid phone number'),
  // ✅ SECURITY FIX: Role NOT accepted during registration
  // Server controls role assignment - prevents privilege escalation
  // Users cannot inject 'agent' or other roles during signup
];

exports.loginSchema = [
  body('email').notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.updateUserRoleSchema = [
  body('userId').notEmpty().isMongoId().withMessage('Invalid user ID'),
  body('newRole').notEmpty().isIn(['buyer', 'owner', 'agent']).withMessage('Role must be: buyer, owner, or agent'),
];

exports.changePasswordSchema = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .custom((val, { req }) => {
      if (val === req.body.currentPassword) throw new Error('New password must be different from current password');
      return true;
    }),
];
