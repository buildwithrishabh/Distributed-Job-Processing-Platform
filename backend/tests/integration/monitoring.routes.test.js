import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  aggregate: vi.fn(),
};

const mockUserModel = {
  findById: vi.fn(),
};

const mockJobQueue = {
  name: "job-queue",
  getWaitingCount: vi.fn().mockResolvedValue(5),
  getActiveCount: vi.fn().mockResolvedValue(2),
  getDelayedCount: vi.fn().mockResolvedValue(1),
  getFailedCount: vi.fn().mockResolvedValue(0),
  getCompletedCount: vi.fn().mockResolvedValue(20),
};

const mockHeartbeat = {
  getActiveWorker: vi.fn().mockResolvedValue([
    { workerId: "worker-1", status: "alive" },
  ]),
};

require.cache[require.resolve("../../src/models/job")] = {
  id: require.resolve("../../src/models/job"),
  filename: require.resolve("../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

require.cache[require.resolve("../../src/models/user")] = {
  id: require.resolve("../../src/models/user"),
  filename: require.resolve("../../src/models/user"),
  loaded: true,
  exports: mockUserModel,
};

require.cache[require.resolve("../../src/queues/job.queue")] = {
  id: require.resolve("../../src/queues/job.queue"),
  filename: require.resolve("../../src/queues/job.queue"),
  loaded: true,
  exports: { jobQueue: mockJobQueue },
};

require.cache[require.resolve("../../src/utils/heartBeat")] = {
  id: require.resolve("../../src/utils/heartBeat"),
  filename: require.resolve("../../src/utils/heartBeat"),
  loaded: true,
  exports: mockHeartbeat,
};

const app = require("../../src/app");
const { TEST_USER, createTestToken } = require("./helpers");

describe("Integration: Monitoring Routes (/api/monitoring/*)", () => {
  const token = createTestToken(TEST_USER);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(TEST_USER),
    });
  });

  describe("Authentication Guard", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const res = await request(app).get("/api/monitoring/overview");
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Access token missing");
    });
  });

  describe("GET /api/monitoring/queue", () => {
    it("should return BullMQ queue metrics with 200", async () => {
      const res = await request(app)
        .get("/api/monitoring/queue")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.queueName).toBe("job-queue");
      expect(res.body.waiting).toBe(5);
      expect(res.body.active).toBe(2);
      expect(res.body.totalInMemory).toBe(28);
    });
  });

  describe("GET /api/monitoring/jobs", () => {
    it("should return aggregated job status breakdown with 200", async () => {
      mockJobModel.aggregate.mockResolvedValue([
        { _id: "COMPLETED", count: 20 },
        { _id: "PENDING", count: 5 },
      ]);

      const res = await request(app)
        .get("/api/monitoring/jobs")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.COMPLETED).toBe(20);
      expect(res.body.PENDING).toBe(5);
      expect(res.body.FAILED).toBe(0);
      expect(res.body.total).toBe(25);
    });
  });

  describe("GET /api/monitoring/workers", () => {
    it("should return active worker list and count with 200", async () => {
      const res = await request(app)
        .get("/api/monitoring/workers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.activeWorkerCount).toBe(1);
      expect(res.body.workers[0].workerId).toBe("worker-1");
    });
  });

  describe("GET /api/monitoring/overview", () => {
    it("should return complete system overview metric aggregation with 200", async () => {
      mockJobModel.aggregate.mockResolvedValue([
        { _id: "COMPLETED", count: 10 },
      ]);

      const res = await request(app)
        .get("/api/monitoring/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.queue).toBeDefined();
      expect(res.body.jobs).toBeDefined();
      expect(res.body.workers).toBeDefined();
    });
  });
});
