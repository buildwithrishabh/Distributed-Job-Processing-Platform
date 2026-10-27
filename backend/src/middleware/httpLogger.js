const pinoHttp = require("pino-http");
const crypto = require("crypto");
const logger = require("../utils/logger");

const httpLogger = pinoHttp({
  logger,
  // Use existing header or generate a unique ID for request tracing
  genReqId: (req) => req.headers["x-request-id"] || crypto.randomUUID(),

  // Custom log message on completion
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.originalUrl} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.originalUrl} failed: ${err.message}`,
});

module.exports = httpLogger;