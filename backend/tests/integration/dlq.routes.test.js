import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
};

const mockUserModel = {
  findById: vi.fn(),
};

const mockJobQueue = {
  getJob: vi.fn(),
};

const mockQueue = {
  addJobToQueue: vi.fn(),
  jobQueue: mockJobQueue,
};

const mockLock = {
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
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

require.cache[require.resolve("../../src/utils/lock")] = {
  id: require.resolve("../../src/utils/lock"),
  filename: require.resolve("../../src/utils/lock"),
  loaded: true,
  exports: mockLock,
};

const app = require("../../src/app");
const { JOB_STATUS } = require("../../src/config/constant");
const { TEST_USER, createTestToken } = require("./helpers");

describe("Integration: DLQ Routes (/api/jobs/dead, /api/jobs/:id/retry)", () => {
  const token = createTestToken(TEST_USER);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(TEST_USER),
    });
  });

  describe("GET /api/jobs/dead", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/jobs/dead");
      expect(res.status).toBe(401);
    });

    it("should return dead jobs with 200 for authenticated user", async () => {
      const deadJobs = [
        {
          jobId: "dead_1",
          status: JOB_STATUS.DEAD,
          error: { message: "exhausted attempts" },
        },
      ];

      mockJobModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(deadJobs),
      });
      mockJobModel.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/jobs/dead?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toEqual(deadJobs);
      expect(res.body.total).toBe(1);
    });
  });

  describe("POST /api/jobs/:id/retry", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).post("/api/jobs/dead_1/retry");
      expect(res.status).toBe(401);
    });

    it("should successfully retry a DEAD job and re-enqueue with 200", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-retry");

      const deadJob = {
        jobId: "dead_job_to_retry",
        status: JOB_STATUS.DEAD,
        attempts: 3,
        userId: TEST_USER._id,
        save: vi.fn().mockResolvedValue(true),
      };

      mockJobModel.findOne.mockResolvedValue(deadJob);
      mockJobQueue.getJob.mockResolvedValue({
        remove: vi.fn().mockResolvedValue(true),
      });
      mockQueue.addJobToQueue.mockResolvedValue({ id: "bull-retried" });

      const res = await request(app)
        .post("/api/jobs/dead_job_to_retry/retry")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Job successfully re-queued for processing");
      expect(deadJob.status).toBe(JOB_STATUS.PENDING);
      expect(deadJob.attempts).toBe(0);
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });

    it("should return 400 when another concurrent retry request holds the lock", async () => {
      mockLock.acquireLock.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/jobs/locked_job/retry")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Job Retry is currently being processed");
    });

    it("should return 404 when job to retry does not exist", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-retry");
      mockJobModel.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/jobs/unknown_job/retry")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });

    it("should return 400 when job is not in DEAD or FAILED status", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-retry");
      const activeJob = {
        jobId: "active_job",
        status: JOB_STATUS.PROCESSING,
        userId: TEST_USER._id,
      };
      mockJobModel.findOne.mockResolvedValue(activeJob);

      const res = await request(app)
        .post("/api/jobs/active_job/retry")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Job is not in dead or failed state");
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });
  });
});
