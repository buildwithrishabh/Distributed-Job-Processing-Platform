const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  // Redact sensitive headers and keys automatically
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "brevoApiKey",
    ],
    remove: true,
  },

  //   Pretty printing in development, raw structured JSON in production
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  base: {
    service: "job-processing-platform",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
