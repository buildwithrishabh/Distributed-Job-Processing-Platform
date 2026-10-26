const Redis = require("ioredis");
const env = require("./env");

const redisOptions = env.REDIS_URL
  ? {
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

const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, redisOptions)
  : new Redis(redisOptions);

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

module.exports = redisClient;