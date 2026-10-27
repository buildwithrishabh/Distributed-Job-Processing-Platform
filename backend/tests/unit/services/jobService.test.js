import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  create: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
  findByIdAndUpdate: vi.fn(),
};

const mockQueue = {
  addJobToQueue: vi.fn(),
};

const mockIdempotency = {
  saveIdempotencyKey: vi.fn(),
  saveIdempotency: vi.fn(),
};

const mockRedis = {
  del: vi.fn().mockResolvedValue(1),
  on: vi.fn(),
};

// Inject mocks into require.cache
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

require.cache[require.resolve("../../../src/middleware/idempotency")] = {
  id: require.resolve("../../../src/middleware/idempotency"),
  filename: require.resolve("../../../src/middleware/idempotency"),
  loaded: true,
  exports: mockIdempotency,
};

require.cache[require.resolve("../../../src/config/redis")] = {
  id: require.resolve("../../../src/config/redis"),
  filename: require.resolve("../../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

// Load service after cache injection
delete require.cache[require.resolve("../../../src/services/jobService")];
const {
  createJobService,
  getJobService,
  getJobByIdService,
  cancelJobService,
} = require("../../../src/services/jobService");

const { JOB_STATUS, JOB_TYPES } = require("../../../src/config/constant");

describe("Service: jobService", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createJobService", () => {
    it("should throw 401 if userId is missing", async () => {
      await expect(
        createJobService({ type: JOB_TYPES.EMAIL, payload: {} })
      ).rejects.toThrow("User ID is required to create a job");
    });

    it("should create a job and enqueue to BullMQ successfully", async () => {
      const mockDbJob = {
        _id: "507f1f77bcf86cd799439012",
        jobId: "job_12345",
        type: JOB_TYPES.EMAIL,
        payload: { to: "a@b.com" },
        status: JOB_STATUS.PENDING,
        priority: 1,
        maxAttempts: 3,
        userId,
      };

      mockJobModel.create.mockResolvedValue(mockDbJob);
      mockQueue.addJobToQueue.mockResolvedValue({ id: "bull-1" });

      const result = await createJobService({
        type: JOB_TYPES.EMAIL,
        payload: { to: "a@b.com" },
        priority: 1,
        maxAttempts: 3,
        userId,
      });

      expect(mockJobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JOB_TYPES.EMAIL,
          userId,
          status: JOB_STATUS.PENDING,
        })
      );
      expect(mockQueue.addJobToQueue).toHaveBeenCalledWith(mockDbJob);
      expect(result).toEqual(mockDbJob);
    });

    it("should rollback to FAILED and clear Redis lock if BullMQ enqueue fails", async () => {
      const mockDbJob = {
        _id: "507f1f77bcf86cd799439013",
        jobId: "job_error",
        type: JOB_TYPES.EMAIL,
      };

      mockJobModel.create.mockResolvedValue(mockDbJob);
      mockQueue.addJobToQueue.mockRejectedValue(new Error("BullMQ Redis down"));

      await expect(
        createJobService({
          type: JOB_TYPES.EMAIL,
          userId,
          idempotencyRedisKey: "idempotency:lock-key",
        })
      ).rejects.toThrow("Failed to enqueue job to processing queue");

      expect(mockJobModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockDbJob._id,
        expect.objectContaining({
          status: JOB_STATUS.FAILED,
        })
      );
      expect(mockRedis.del).toHaveBeenCalledWith("idempotency:lock-key");
    });

    it("should handle MongoDB duplicate key (11000) race condition for idempotency", async () => {
      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;

      mockJobModel.create.mockRejectedValue(duplicateError);

      const existingJob = {
        jobId: "existing_job_1",
        type: JOB_TYPES.EMAIL,
        userId,
        idempotencyKey: "dup-key",
      };
      mockJobModel.findOne.mockResolvedValue(existingJob);

      const result = await createJobService({
        type: JOB_TYPES.EMAIL,
        userId,
        idempotencyKey: "dup-key",
        idempotencyRedisKey: "idempotency:dup-key",
      });

      expect(mockJobModel.findOne).toHaveBeenCalledWith({
        userId,
        idempotencyKey: "dup-key",
      });
      expect(mockIdempotency.saveIdempotencyKey).toHaveBeenCalledWith(
        "idempotency:dup-key",
        "existing_job_1"
      );
      expect(result._isDuplicate).toBe(true);
    });
  });

  describe("getJobService", () => {
    it("should query jobs with pagination and status filter", async () => {
      const mockJobs = [{ jobId: "j1" }, { jobId: "j2" }];
      const mockSort = vi.fn().mockReturnThis();
      const mockSkip = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockJobs);

      mockJobModel.find.mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
      });
      mockJobModel.countDocuments.mockResolvedValue(20);

      const result = await getJobService({
        page: 2,
        limit: 10,
        status: JOB_STATUS.PENDING,
        userId,
      });

      expect(mockJobModel.find).toHaveBeenCalledWith({
        userId,
        status: JOB_STATUS.PENDING,
      });
      expect(mockSkip).toHaveBeenCalledWith(10);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result.total).toBe(20);
      expect(result.page).toBe(2);
      expect(result.jobs).toEqual(mockJobs);
    });
  });

  describe("getJobByIdService", () => {
    it("should find a job by jobId and userId", async () => {
      const mockJob = { jobId: "job-100", userId };
      mockJobModel.findOne.mockResolvedValue(mockJob);

      const result = await getJobByIdService("job-100", userId);

      expect(mockJobModel.findOne).toHaveBeenCalledWith({
        jobId: "job-100",
        userId,
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe("cancelJobService", () => {
    it("should return null if job does not exist", async () => {
      mockJobModel.findOne.mockResolvedValue(null);

      const result = await cancelJobService("non-existent", userId);
      expect(result).toBeNull();
    });

    it("should throw 400 error if job is not in PENDING status", async () => {
      const completedJob = {
        jobId: "j-completed",
        status: JOB_STATUS.COMPLETED,
        userId,
      };
      mockJobModel.findOne.mockResolvedValue(completedJob);

      await expect(
        cancelJobService("j-completed", userId)
      ).rejects.toThrow("Cannot cancel job in COMPLETED status");
    });

    it("should cancel a PENDING job and update status to CANCELLED", async () => {
      const pendingJob = {
        jobId: "j-pending",
        status: JOB_STATUS.PENDING,
        userId,
        save: vi.fn().mockResolvedValue(true),
      };
      mockJobModel.findOne.mockResolvedValue(pendingJob);

      const result = await cancelJobService("j-pending", userId);

      expect(pendingJob.status).toBe(JOB_STATUS.CANCELLED);
      expect(pendingJob.error.message).toBe("Cancelled by user request");
      expect(pendingJob.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(pendingJob);
    });
  });
});
