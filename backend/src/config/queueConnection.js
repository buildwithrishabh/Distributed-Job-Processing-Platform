const env = require("./env");

const bullMQConnection = env.REDIS_URL
  ? {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null,
      tls: env.REDIS_URL.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
    }
  : {
      host: env.REDIS_HOST || "127.0.0.1",
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    };

module.exports = bullMQConnection;