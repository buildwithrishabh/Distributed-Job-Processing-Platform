import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
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

require.cache[require.resolve("../../../src/models/job")] = {
  id: require.resolve("../../../src/models/job"),
  filename: require.resolve("../../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

require.cache[require.resolve("../../../src/queues/job.queue")] = {
  id: require.resolve("../../../src/queues/job.queue"),
  filename: require.resolve("../../../src/queues/job.queue"),
  loaded: true,
  exports: mockQueue,
};

require.cache[require.resolve("../../../src/utils/lock")] = {
  id: require.resolve("../../../src/utils/lock"),
  filename: require.resolve("../../../src/utils/lock"),
  loaded: true,
  exports: mockLock,
};

delete require.cache[require.resolve("../../../src/services/dlqService")];
const {
  getDeadJobService,
  retryDeadJobService,
} = require("../../../src/services/dlqService");

const { JOB_STATUS } = require("../../../src/config/constant");

describe("Service: dlqService", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDeadJobService", () => {
    it("should return dead jobs with pagination", async () => {
      const mockDeadJobs = [{ jobId: "dead-1" }, { jobId: "dead-2" }];
      const mockSort = vi.fn().mockReturnThis();
      const mockSkip = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockDeadJobs);

      mockJobModel.find.mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
      });
      mockJobModel.countDocuments.mockResolvedValue(2);

      const result = await getDeadJobService({ page: 1, limit: 10, userId });

      expect(mockJobModel.find).toHaveBeenCalledWith({
        status: JOB_STATUS.DEAD,
        userId,
      });
      expect(result.jobs).toEqual(mockDeadJobs);
      expect(result.total).toBe(2);
    });
  });

  describe("retryDeadJobService", () => {
    it("should throw 400 if lock cannot be acquired (concurrency protection)", async () => {
      mockLock.acquireLock.mockResolvedValue(null);

      await expect(
        retryDeadJobService("job-1", userId)
      ).rejects.toThrow(
        "Job Retry is currently being processed by another request"
      );
    });

    it("should throw 404 if dead job is not found", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-1");
      mockJobModel.findOne.mockResolvedValue(null);

      await expect(
        retryDeadJobService("job-not-found", userId)
      ).rejects.toThrow("Job not found");

      expect(mockLock.releaseLock).toHaveBeenCalledWith(
        "dlq:retry:job-not-found",
        "lock-token-1"
      );
    });

    it("should throw 400 if job is not in DEAD or FAILED state", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-2");
      const activeJob = {
        jobId: "job-active",
        status: JOB_STATUS.PROCESSING,
        userId,
      };
      mockJobModel.findOne.mockResolvedValue(activeJob);

      await expect(
        retryDeadJobService("job-active", userId)
      ).rejects.toThrow("Job is not in dead or failed state");

      expect(mockLock.releaseLock).toHaveBeenCalledWith(
        "dlq:retry:job-active",
        "lock-token-2"
      );
    });

    it("should reset job to PENDING, remove existing BullMQ job, and re-enqueue", async () => {
      mockLock.acquireLock.mockResolvedValue("lock-token-success");
      const deadJob = {
        jobId: "job-dead-ok",
        status: JOB_STATUS.DEAD,
        attempts: 3,
        error: { message: "failed" },
        userId,
        save: vi.fn().mockResolvedValue(true),
      };
      mockJobModel.findOne.mockResolvedValue(deadJob);

      const mockBullJob = { remove: vi.fn().mockResolvedValue(true) };
      mockJobQueue.getJob.mockResolvedValue(mockBullJob);
      mockQueue.addJobToQueue.mockResolvedValue({ id: "bull-re-enqueued" });

      const result = await retryDeadJobService("job-dead-ok", userId);

      expect(deadJob.status).toBe(JOB_STATUS.PENDING);
      expect(deadJob.attempts).toBe(0);
      expect(deadJob.error).toBeUndefined();
      expect(deadJob.save).toHaveBeenCalledTimes(1);
      expect(mockBullJob.remove).toHaveBeenCalledTimes(1);
      expect(mockQueue.addJobToQueue).toHaveBeenCalledWith(deadJob);
      expect(mockLock.releaseLock).toHaveBeenCalledWith(
        "dlq:retry:job-dead-ok",
        "lock-token-success"
      );
      expect(result).toBe(deadJob);
    });
  });
});
