/**
 * Global Error Handling Middleware
 */
const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const log = req.log || logger;

  log.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      statusCode: err.statusCode || 500,
    },
    `[Error] ${req.method} ${req.originalUrl}: ${err.message}`,
  );

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
  
};

module.exports = errorHandler;
