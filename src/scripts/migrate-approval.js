require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for migration');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const migrateApprovalStatus = async () => {
  try {
    await connectDB();

    console.log('🚀 Starting Data Migration: isApproved -> approvalStatus...');

    // 1. Migrate Properties
    const db = mongoose.connection.db;
    
    // Convert isApproved: true -> approvalStatus: 'approved'
    const propApprovedRes = await db.collection('properties').updateMany(
      { isApproved: true },
      { $set: { approvalStatus: 'approved' }, $unset: { isApproved: "" } }
    );
    console.log(`✅ Migrated Properties (Approved): ${propApprovedRes.modifiedCount}`);

    // Convert isApproved: false/null/missing -> approvalStatus: 'pending' (if not already set)
    const propPendingRes = await db.collection('properties').updateMany(
      { $or: [{ isApproved: false }, { isApproved: { $exists: false } }], approvalStatus: { $exists: false } },
      { $set: { approvalStatus: 'pending' }, $unset: { isApproved: "" } }
    );
    console.log(`✅ Migrated Properties (Pending): ${propPendingRes.modifiedCount}`);

    // Clean up any remaining isApproved fields that might have approvalStatus already set
    await db.collection('properties').updateMany(
      { isApproved: { $exists: true } },
      { $unset: { isApproved: "" } }
    );

    // 2. Migrate Auctions
    const aucApprovedRes = await db.collection('auctions').updateMany(
      { isApproved: true },
      { $set: { approvalStatus: 'approved' }, $unset: { isApproved: "" } }
    );
    console.log(`✅ Migrated Auctions (Approved): ${aucApprovedRes.modifiedCount}`);

    const aucPendingRes = await db.collection('auctions').updateMany(
      { $or: [{ isApproved: false }, { isApproved: { $exists: false } }], approvalStatus: { $exists: false } },
      { $set: { approvalStatus: 'pending' }, $unset: { isApproved: "" } }
    );
    console.log(`✅ Migrated Auctions (Pending): ${aucPendingRes.modifiedCount}`);

    await db.collection('auctions').updateMany(
      { isApproved: { $exists: true } },
      { $unset: { isApproved: "" } }
    );

    console.log('🎉 Migration Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrateApprovalStatus();
