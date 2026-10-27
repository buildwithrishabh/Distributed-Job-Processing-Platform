import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  aggregate: vi.fn(),
};

const mockJobQueue = {
  name: "job-queue",
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getDelayedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getCompletedCount: vi.fn(),
};

const mockHeartbeat = {
  getActiveWorker: vi.fn(),
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
  exports: { jobQueue: mockJobQueue },
};

require.cache[require.resolve("../../../src/utils/heartBeat")] = {
  id: require.resolve("../../../src/utils/heartBeat"),
  filename: require.resolve("../../../src/utils/heartBeat"),
  loaded: true,
  exports: mockHeartbeat,
};

delete require.cache[require.resolve("../../../src/services/monitoringService")];
const {
  getQueueMetricsService,
  getJobStatsService,
  getWorkerMetricsService,
} = require("../../../src/services/monitoringService");

describe("Service: monitoringService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQueueMetricsService", () => {
    it("should return comprehensive BullMQ queue counters and total in memory", async () => {
      mockJobQueue.getWaitingCount.mockResolvedValue(5);
      mockJobQueue.getActiveCount.mockResolvedValue(2);
      mockJobQueue.getDelayedCount.mockResolvedValue(1);
      mockJobQueue.getFailedCount.mockResolvedValue(3);
      mockJobQueue.getCompletedCount.mockResolvedValue(10);

      const metrics = await getQueueMetricsService();

      expect(metrics).toEqual({
        queueName: "job-queue",
        waiting: 5,
        active: 2,
        delayed: 1,
        failed: 3,
        completed: 10,
        totalInMemory: 21,
      });
    });
  });

  describe("getJobStatsService", () => {
    it("should return formatted job stats grouped by status", async () => {
      mockJobModel.aggregate.mockResolvedValue([
        { _id: "COMPLETED", count: 12 },
        { _id: "FAILED", count: 2 },
        { _id: "PENDING", count: 5 },
      ]);

      const stats = await getJobStatsService("65f1a2b3c4d5e6f7a8b9c0d1");

      expect(stats.COMPLETED).toBe(12);
      expect(stats.FAILED).toBe(2);
      expect(stats.PENDING).toBe(5);
      expect(stats.DEAD).toBe(0);
      expect(stats.total).toBe(19);
    });
  });

  describe("getWorkerMetricsService", () => {
    it("should return active workers list and count", async () => {
      const mockWorkers = [
        { workerId: "worker-1", status: "alive" },
        { workerId: "worker-2", status: "alive" },
      ];
      mockHeartbeat.getActiveWorker.mockResolvedValue(mockWorkers);

      const result = await getWorkerMetricsService();

      expect(result.activeWorkerCount).toBe(2);
      expect(result.workers).toEqual(mockWorkers);
    });
  });
});
