const dns = require('dns');
const mongoose = require('mongoose');
const { MONGO_URI, NODE_ENV } = require('./env');
const logger = require('../utils/logger');

// In Development use DNS to start mongodb
if (NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    logger.info({ host: conn.connection.host }, `[MongoDB] Connected to database`);
  } catch (error) {
    logger.fatal({ err: error }, `[MongoDB] Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;