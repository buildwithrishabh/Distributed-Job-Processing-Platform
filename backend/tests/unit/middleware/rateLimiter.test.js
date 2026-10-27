import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  multi: vi.fn(() => mockPipeline),
  on: vi.fn(),
};

require.cache[require.resolve("../../../src/config/redis")] = {
  id: require.resolve("../../../src/config/redis"),
  filename: require.resolve("../../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

delete require.cache[require.resolve("../../../src/middleware/rateLimiter")];
const slidingWindowRateLimiter = require("../../../src/middleware/rateLimiter");

describe("Middleware: slidingWindowRateLimiter", () => {
  const createReqRes = (user = null, ip = "127.0.0.1") => {
    const req = {
      user,
      ip,
      log: { error: vi.fn() },
    };
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow request and set rate limit headers when under the limit", async () => {
    const limiter = slidingWindowRateLimiter({
      windowMs: 60000,
      max: 10,
      prefix: "test-limit",
    });

    const { req, res, next } = createReqRes({ _id: "user-123" });
    // mockPipeline.exec returns results array where index 2 is [null, count]
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 3], // count = 3 requests
      [null, 1],
    ]);

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 10);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 7);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject with 429 when request count exceeds max limit", async () => {
    const limiter = slidingWindowRateLimiter({
      windowMs: 60000,
      max: 5,
      prefix: "test-limit",
      message: "Rate limit exceeded.",
    });

    const { req, res, next } = createReqRes(null, "192.168.1.1");
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6], // count = 6, max = 5
      [null, 1],
    ]);

    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", 60);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Too Many Requests",
        message: "Rate limit exceeded.",
      })
    );
  });

  it("should fail open and call next if Redis throws an exception", async () => {
    const limiter = slidingWindowRateLimiter();
    const { req, res, next } = createReqRes();

    mockPipeline.exec.mockRejectedValue(new Error("Redis connection timeout"));

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.log.error).toHaveBeenCalled();
  });
});
