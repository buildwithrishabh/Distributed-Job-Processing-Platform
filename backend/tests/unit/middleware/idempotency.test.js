import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  on: vi.fn(),
};

const mockJobModel = {
  findOne: vi.fn(),
};

require.cache[require.resolve("../../../src/config/redis")] = {
  id: require.resolve("../../../src/config/redis"),
  filename: require.resolve("../../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

require.cache[require.resolve("../../../src/models/job")] = {
  id: require.resolve("../../../src/models/job"),
  filename: require.resolve("../../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

delete require.cache[require.resolve("../../../src/middleware/idempotency")];
const {
  idempotencyMiddleware,
  saveIdempotency,
} = require("../../../src/middleware/idempotency");

describe("Middleware: idempotencyMiddleware", () => {
  const mockUser = { _id: "user-123" };

  const createReqRes = (headers = {}, user = mockUser) => {
    const req = {
      headers,
      user,
      log: { info: vi.fn(), error: vi.fn() },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass through to next() if no Idempotency-Key header is present", async () => {
    const { req, res, next } = createReqRes({});

    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should acquire lock and set keys on req when key is new", async () => {
    const { req, res, next } = createReqRes({
      "idempotency-key": "req-key-001",
    });

    mockRedis.set.mockResolvedValue("OK"); // acquired

    await idempotencyMiddleware(req, res, next);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "idempotency:user-123:req-key-001",
      "IN_PROGRESS",
      "EX",
      30,
      "NX"
    );
    expect(req.idempotencyKey).toBe("req-key-001");
    expect(req.idempotencyRedisKey).toBe("idempotency:user-123:req-key-001");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should return 409 Conflict if parallel request is currently IN_PROGRESS", async () => {
    const { req, res, next } = createReqRes({
      "idempotency-key": "req-key-002",
    });

    mockRedis.set.mockResolvedValue(null); // lock failed
    mockRedis.get.mockResolvedValue("IN_PROGRESS");

    await idempotencyMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("currently being processed"),
      })
    );
  });

  it("should return 200 with existing job if request is duplicate and job exists", async () => {
    const { req, res, next } = createReqRes({
      "idempotency-key": "req-key-003",
    });

    const existingJob = {
      jobId: "job_cached_123",
      type: "email",
      status: "COMPLETED",
      createdAt: new Date(),
    };

    mockRedis.set.mockResolvedValue(null); // lock failed
    mockRedis.get.mockResolvedValue("job_cached_123");
    mockJobModel.findOne.mockResolvedValue(existingJob);

    await idempotencyMiddleware(req, res, next);

    expect(mockJobModel.findOne).toHaveBeenCalledWith({
      jobId: "job_cached_123",
      userId: "user-123",
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isDuplicate: true,
        job: expect.objectContaining({
          jobId: "job_cached_123",
          status: "COMPLETED",
        }),
      })
    );
  });

  it("should save idempotency key with TTL", async () => {
    mockRedis.set.mockResolvedValue("OK");

    await saveIdempotency("test-redis-key", "job_999", 3600);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "test-redis-key",
      "job_999",
      "EX",
      3600
    );
  });
});
