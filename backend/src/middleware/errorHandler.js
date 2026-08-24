/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging / server logs
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.stack || err.message || err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
