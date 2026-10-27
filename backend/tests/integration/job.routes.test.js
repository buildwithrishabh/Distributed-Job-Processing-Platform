import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  create: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  findByIdAndUpdate: vi.fn(),
};

const mockUserModel = {
  findById: vi.fn(),
};

const mockQueue = {
  addJobToQueue: vi.fn(),
  jobQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(10),
  },
};

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([
    [null, 0],
    [null, 1],
    [null, 1],
    [null, 1],
  ]),
};

const mockRedis = {
  set: vi.fn().mockResolvedValue("OK"),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
  multi: vi.fn(() => mockPipeline),
  on: vi.fn(),
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
  exports: mockQueue,
};

require.cache[require.resolve("../../src/config/redis")] = {
  id: require.resolve("../../src/config/redis"),
  filename: require.resolve("../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

const app = require("../../src/app");
const { JOB_STATUS, JOB_TYPES } = require("../../src/config/constant");
const { TEST_USER, createTestToken } = require("./helpers");

describe("Integration: Job Routes (/api/jobs)", () => {
  const token = createTestToken(TEST_USER);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(TEST_USER),
    });
  });

  describe("POST /api/jobs", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app).post("/api/jobs").send({
        type: JOB_TYPES.EMAIL,
        payload: { to: "test@example.com", subject: "Test" },
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Access token missing");
    });

    it("should return 400 when job payload fails schema validation", async () => {
      const res = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "unsupported_type",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toBeDefined();
    });

    it("should successfully enqueue a valid job and return 202 Accepted", async () => {
      const createdJob = {
        jobId: "job_int_123",
        type: JOB_TYPES.EMAIL,
        status: JOB_STATUS.PENDING,
        createdAt: new Date().toISOString(),
      };

      mockJobModel.create.mockResolvedValue(createdJob);
      mockQueue.addJobToQueue.mockResolvedValue({ id: "bull-job-1" });

      const res = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: JOB_TYPES.EMAIL,
          payload: { to: "recipient@example.com", subject: "Hello" },
        });

      expect(res.status).toBe(202);
      expect(res.body.message).toBe("Job accepted and enqueued");
      expect(res.body.job.jobId).toBe("job_int_123");
      expect(res.body.job.status).toBe(JOB_STATUS.PENDING);
    });

    it("should return 200 with existing job when duplicate Idempotency-Key is provided", async () => {
      const existingJob = {
        jobId: "job_cached_999",
        type: JOB_TYPES.EMAIL,
        status: JOB_STATUS.COMPLETED,
        createdAt: new Date().toISOString(),
      };

      mockRedis.set.mockResolvedValue(null); // lock not acquired
      mockRedis.get.mockResolvedValue("job_cached_999"); // cached jobId
      mockJobModel.findOne.mockResolvedValue(existingJob);

      const res = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "idem-duplicate-key-1")
        .send({
          type: JOB_TYPES.EMAIL,
          payload: { to: "recipient@example.com", subject: "Hello" },
        });

      expect(res.status).toBe(200);
      expect(res.body.isDuplicate).toBe(true);
      expect(res.body.job.jobId).toBe("job_cached_999");
    });
  });

  describe("GET /api/jobs", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/jobs");
      expect(res.status).toBe(401);
    });

    it("should return paginated jobs for authenticated user", async () => {
      const mockJobs = [
        { jobId: "j1", type: "email", status: "PENDING" },
        { jobId: "j2", type: "email", status: "COMPLETED" },
      ];

      mockJobModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockJobs),
      });
      mockJobModel.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/jobs?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toEqual(mockJobs);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("should return job details when found", async () => {
      const job = {
        jobId: "job_lookup_1",
        type: "email",
        status: "PROCESSING",
        userId: TEST_USER._id,
      };

      mockJobModel.findOne.mockResolvedValue(job);

      const res = await request(app)
        .get("/api/jobs/job_lookup_1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.jobId).toBe("job_lookup_1");
    });

    it("should return 404 when job does not exist", async () => {
      mockJobModel.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/jobs/non_existent_id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
    });
  });

  describe("DELETE /api/jobs/:id", () => {
    it("should cancel a PENDING job and return 200", async () => {
      const pendingJob = {
        jobId: "job_cancel_pending",
        status: JOB_STATUS.PENDING,
        userId: TEST_USER._id,
        save: vi.fn().mockResolvedValue(true),
      };

      mockJobModel.findOne.mockResolvedValue(pendingJob);

      const res = await request(app)
        .delete("/api/jobs/job_cancel_pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Job cancelled successfully");
      expect(pendingJob.status).toBe(JOB_STATUS.CANCELLED);
    });

    it("should return 400 when attempting to cancel an already COMPLETED job", async () => {
      const completedJob = {
        jobId: "job_cancel_done",
        status: JOB_STATUS.COMPLETED,
        userId: TEST_USER._id,
      };

      mockJobModel.findOne.mockResolvedValue(completedJob);

      const res = await request(app)
        .delete("/api/jobs/job_cancel_done")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot cancel job in COMPLETED status");
    });

    it("should return 404 when job to cancel is not found", async () => {
      mockJobModel.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/jobs/unknown_job")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
    });
  });
});
