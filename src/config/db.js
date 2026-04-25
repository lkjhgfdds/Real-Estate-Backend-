const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // MongoDB Atlas recommended options
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    logger.info(` MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (err) {
    // Ensure the error is visible even if the logger doesn't flush before exit.
    try {
      // Avoid printing the full URI (may contain credentials); message is enough.
      console.error(`MongoDB Connection Error: ${err.message}`);
    } catch (_) {}

    logger.error(` MongoDB Connection Error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
