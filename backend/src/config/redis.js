const Redis = require("ioredis");
const env = require("./env");

const redisClient = new Redis({
  host: env.REDIS_HOST || "127.0.0.1",
  port: env.REDIS_PORT || 6379,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

module.exports = redisClient;
