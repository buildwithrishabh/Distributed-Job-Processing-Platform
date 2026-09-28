const redisClient = require("../config/redis");
const env = require("../config/env");


function slidingWindowRateLimiter({
  windowMs = (env.RATE_LIMIT_WINDOW_SECONDS || 60) * 1000,
  max = env.RATE_LIMIT_MAX_REQUESTS || 10,
  prefix = "rate-limit",
  message = "Too many requests. Please try again later.",
} = {}) {
  return async (req, res, next) => {
    try {
      // 1. Identify client: user ID if logged in, else IP address
      const identifier = req.user?._id?.toString() || req.user?.id || req.ip;
      const key = `${prefix}:${identifier}`;

      const now = Date.now();
      const windowStart = now - windowMs;
      const requestId = `${now}-${Math.random().toString(36).substring(2, 9)}`;

      // 2. Atomic Redis pipeline operations for sliding window
      const pipeline = redisClient.multi();
      pipeline.zremrangebyscore(key, 0, windowStart); // Remove requests outside the window
      pipeline.zadd(key, now, requestId);            // Record current request timestamp
      pipeline.zcard(key);                           // Count requests in the current window
      pipeline.pexpire(key, windowMs);               // Set TTL so inactive keys auto-expire

      const results = await pipeline.exec();
      const requestCount = results[2][1];

      // 3. Set standard rate limit headers
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - requestCount));

      // 4. If limit exceeded, return 429 Too Many Requests
      if (requestCount > max) {
        const retryAfterSeconds = Math.ceil(windowMs / 1000);
        res.setHeader("Retry-After", retryAfterSeconds);

        return res.status(429).json({
          success: false,
          error: "Too Many Requests",
          message,
          retryAfter: retryAfterSeconds,
        });
      }

      next();
    } catch (error) {
      console.error("[RateLimiter] Redis error:", error.message);
      // Fail open: don't block user requests if Redis has an issue
      next();
    }
  };
}

module.exports = slidingWindowRateLimiter;
