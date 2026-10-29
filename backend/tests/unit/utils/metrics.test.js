import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobQueue = {
  name: "test-queue",
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getDelayedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getCompletedCount: vi.fn(),
};

require.cache[require.resolve("../../../src/queues/job.queue")] = {
  id: require.resolve("../../../src/queues/job.queue"),
  filename: require.resolve("../../../src/queues/job.queue"),
  loaded: true,
  exports: { jobQueue: mockJobQueue },
};

const mockGetActiveWorker = vi.fn();
require.cache[require.resolve("../../../src/utils/heartBeat")] = {
  id: require.resolve("../../../src/utils/heartBeat"),
  filename: require.resolve("../../../src/utils/heartBeat"),
  loaded: true,
  exports: { getActiveWorker: mockGetActiveWorker },
};

delete require.cache[require.resolve("../../../src/utils/metrics")];
const {
  register,
  httpRequestDuration,
  httpRequestTotal,
  queueJobCount,
  activeWorkersCount,
  jobExecutionDuration,
  jobsProcessedTotal,
  updateDynamicGauges,
} = require("../../../src/utils/metrics");

describe("Utils: Prometheus Metrics (metrics.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export defined Prometheus metrics objects", () => {
    expect(register).toBeDefined();
    expect(typeof register.metrics).toBe("function");
    expect(httpRequestDuration).toBeDefined();
    expect(httpRequestTotal).toBeDefined();
    expect(queueJobCount).toBeDefined();
    expect(activeWorkersCount).toBeDefined();
    expect(jobExecutionDuration).toBeDefined();
    expect(jobsProcessedTotal).toBeDefined();
  });

  it("should update dynamic gauges with queue counts and active workers count", async () => {
    mockJobQueue.getWaitingCount.mockResolvedValue(12);
    mockJobQueue.getActiveCount.mockResolvedValue(4);
    mockJobQueue.getDelayedCount.mockResolvedValue(1);
    mockJobQueue.getFailedCount.mockResolvedValue(2);
    mockJobQueue.getCompletedCount.mockResolvedValue(150);
    mockGetActiveWorker.mockResolvedValue(["worker-1", "worker-2"]);

    await updateDynamicGauges();

    const metricsText = await register.metrics();
    expect(metricsText).toContain('bullmq_queue_jobs_count{queue="test-queue",state="waiting"} 12');
    expect(metricsText).toContain('bullmq_queue_jobs_count{queue="test-queue",state="active"} 4');
    expect(metricsText).toContain('bullmq_queue_jobs_count{queue="test-queue",state="delayed"} 1');
    expect(metricsText).toContain('bullmq_queue_jobs_count{queue="test-queue",state="failed"} 2');
    expect(metricsText).toContain('bullmq_queue_jobs_count{queue="test-queue",state="completed"} 150');
    expect(metricsText).toContain("job_platform_active_workers_count 2");
  });

  it("should handle error gracefully without throwing when queue query fails", async () => {
    mockJobQueue.getWaitingCount.mockRejectedValue(new Error("Redis connection down"));

    await expect(updateDynamicGauges()).resolves.not.toThrow();
  });
});

