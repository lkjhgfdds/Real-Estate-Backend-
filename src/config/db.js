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
    logger.error(` MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
