require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.DB_URI;

const adminEmail = process.env.ADMIN_EMAIL || 'admin@luxe-estates.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456!';
const adminName = process.env.ADMIN_NAME || 'Luxe Admin';

async function seedAdmin() {
  if (!mongoUri) {
    throw new Error('Missing MongoDB connection string. Set MONGO_URI in .env');
  }

  await mongoose.connect(mongoUri);

  const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');

  if (existingAdmin) {
    existingAdmin.name = existingAdmin.name || adminName;
    existingAdmin.role = 'admin';
    existingAdmin.isActive = true;
    existingAdmin.isBanned = false;
    existingAdmin.isVerified = true;
    existingAdmin.emailVerified = true;
    existingAdmin.kycStatus = 'approved';

    if (adminPassword) {
      existingAdmin.password = adminPassword;
      existingAdmin.passwordConfirm = adminPassword;
    }

    await existingAdmin.save();
    console.log(`Admin account updated: ${adminEmail}`);
  } else {
    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      passwordConfirm: adminPassword,
      role: 'admin',
      isActive: true,
      isBanned: false,
      isVerified: true,
      emailVerified: true,
      kycStatus: 'approved',
    });

    console.log(`Admin account created: ${adminEmail}`);
  }

  console.log(`Admin password: ${adminPassword}`);
}

seedAdmin()
  .catch((error) => {
    console.error('Failed to seed admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
