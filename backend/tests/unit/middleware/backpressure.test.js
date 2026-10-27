import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobQueue = {
  getWaitingCount: vi.fn(),
};

require.cache[require.resolve("../../../src/queues/job.queue")] = {
  id: require.resolve("../../../src/queues/job.queue"),
  filename: require.resolve("../../../src/queues/job.queue"),
  loaded: true,
  exports: { jobQueue: mockJobQueue },
};

delete require.cache[require.resolve("../../../src/middleware/backpressure")];
const backpressureGuard = require("../../../src/middleware/backpressure");
const env = require("../../../src/config/env");

describe("Middleware: backpressureGuard", () => {
  const createReqRes = () => {
    const req = { log: { warn: vi.fn(), error: vi.fn() } };
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

  it("should allow request through when queue size is within capacity", async () => {
    const { req, res, next } = createReqRes();
    mockJobQueue.getWaitingCount.mockResolvedValue(100);

    await backpressureGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 503 and Retry-After header when queue exceeds max capacity", async () => {
    const { req, res, next } = createReqRes();
    const overloadCount = env.MAX_QUEUE_CAPACITY + 500;
    mockJobQueue.getWaitingCount.mockResolvedValue(overloadCount);

    await backpressureGuard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", 30);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Service Unavailable",
        currentQueueSize: overloadCount,
        maxCapacity: env.MAX_QUEUE_CAPACITY,
      })
    );
  });

  it("should fail open and call next if fetching queue size fails", async () => {
    const { req, res, next } = createReqRes();
    mockJobQueue.getWaitingCount.mockRejectedValue(
      new Error("Redis connection dropped")
    );

    await backpressureGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
