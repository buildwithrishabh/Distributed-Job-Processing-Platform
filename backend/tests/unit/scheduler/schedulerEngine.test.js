import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const mockScheduleModel = {
  find: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findByIdAndUpdate: vi.fn().mockResolvedValue(true),
};

const mockExecutionModel = {
  create: vi.fn().mockResolvedValue({}),
};

const mockJobService = {
  createJobService: vi.fn(),
};

const mockLock = {
  acquireLock: vi.fn(),
  releaseLock: vi.fn().mockResolvedValue(true),
};

require.cache[require.resolve("../../../src/models/schedule")] = {
  id: require.resolve("../../../src/models/schedule"),
  filename: require.resolve("../../../src/models/schedule"),
  loaded: true,
  exports: mockScheduleModel,
};

require.cache[require.resolve("../../../src/models/scheduleExecution")] = {
  id: require.resolve("../../../src/models/scheduleExecution"),
  filename: require.resolve("../../../src/models/scheduleExecution"),
  loaded: true,
  exports: mockExecutionModel,
};

require.cache[require.resolve("../../../src/services/jobService")] = {
  id: require.resolve("../../../src/services/jobService"),
  filename: require.resolve("../../../src/services/jobService"),
  loaded: true,
  exports: mockJobService,
};

require.cache[require.resolve("../../../src/utils/lock")] = {
  id: require.resolve("../../../src/utils/lock"),
  filename: require.resolve("../../../src/utils/lock"),
  loaded: true,
  exports: mockLock,
};

delete require.cache[require.resolve("../../../src/scheduler/schedulerEngine")];
const {
  triggerSingleSchedule,
} = require("../../../src/scheduler/schedulerEngine");
const {
  SCHEDULE_STATUS,
  SCHEDULE_TYPES,
  MISFIRE_POLICY,
} = require("../../../src/config/constant");

describe("Scheduler: schedulerEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLock.acquireLock.mockResolvedValue("lock-token-123");
    mockScheduleModel.findOneAndUpdate.mockResolvedValue({ _id: "sched_mongo_1" });
    mockJobService.createJobService.mockResolvedValue({ jobId: "job_123" });
  });

  it("skips execution if distributed lock is held by another instance", async () => {
    mockLock.acquireLock.mockResolvedValue(null);

    await triggerSingleSchedule(
      { scheduleId: "sched_1", nextRunAt: new Date() },
      new Date(),
    );

    expect(mockScheduleModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockJobService.createJobService).not.toHaveBeenCalled();
  });

  it("skips execution if atomic claim returns null (already claimed)", async () => {
    mockScheduleModel.findOneAndUpdate.mockResolvedValue(null);

    await triggerSingleSchedule(
      {
        _id: "sched_mongo_1",
        scheduleId: "sched_1",
        scheduleType: SCHEDULE_TYPES.ONCE,
        nextRunAt: new Date(),
      },
      new Date(),
    );

    expect(mockJobService.createJobService).not.toHaveBeenCalled();
    expect(mockLock.releaseLock).toHaveBeenCalledWith(
      "scheduler:schedule:sched_1",
      "lock-token-123",
    );
  });

  it("triggers ONCE schedule, creates job with deterministic idempotencyKey, and marks COMPLETED", async () => {
    const now = new Date("2026-01-01T10:00:05.000Z");
    const scheduledFor = new Date("2026-01-01T10:00:00.000Z");

    await triggerSingleSchedule(
      {
        _id: "sched_mongo_1",
        scheduleId: "sched_1",
        userId: "user_1",
        jobType: "email",
        payload: { to: "a@b.com", subject: "Hi" },
        scheduleType: SCHEDULE_TYPES.ONCE,
        misfirePolicy: MISFIRE_POLICY.SKIP,
        nextRunAt: scheduledFor,
      },
      now,
    );

    expect(mockScheduleModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: "sched_mongo_1",
        status: SCHEDULE_STATUS.ACTIVE,
        nextRunAt: scheduledFor,
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: SCHEDULE_STATUS.COMPLETED,
          nextRunAt: null,
        }),
      }),
      { new: true },
    );

    expect(mockJobService.createJobService).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "sched_1",
        idempotencyKey: `sched:sched_1:${scheduledFor.toISOString()}`,
      }),
    );

    expect(mockExecutionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "sched_1",
        jobId: "job_123",
        status: "TRIGGERED",
      }),
    );
  });

  it("skips missed occurrence when misfirePolicy is SKIP", async () => {
    const now = new Date("2026-01-01T10:05:00.000Z");
    const scheduledFor = new Date("2026-01-01T10:00:00.000Z"); // 5 mins late (> 60s)

    await triggerSingleSchedule(
      {
        _id: "sched_mongo_1",
        scheduleId: "sched_1",
        userId: "user_1",
        scheduleType: SCHEDULE_TYPES.RECURRING,
        cronExpression: "*/5 * * * *",
        timezone: "UTC",
        misfirePolicy: MISFIRE_POLICY.SKIP,
        nextRunAt: scheduledFor,
      },
      now,
    );

    expect(mockJobService.createJobService).not.toHaveBeenCalled();
    expect(mockExecutionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "sched_1",
        status: "SKIPPED",
      }),
    );
  });

  it("runs once for missed occurrence when misfirePolicy is RUN_ONCE", async () => {
    const now = new Date("2026-01-01T10:05:00.000Z");
    const scheduledFor = new Date("2026-01-01T10:00:00.000Z");

    await triggerSingleSchedule(
      {
        _id: "sched_mongo_1",
        scheduleId: "sched_1",
        userId: "user_1",
        jobType: "email",
        payload: { to: "a@b.com", subject: "Catch up" },
        scheduleType: SCHEDULE_TYPES.RECURRING,
        cronExpression: "*/5 * * * *",
        timezone: "UTC",
        misfirePolicy: MISFIRE_POLICY.RUN_ONCE,
        nextRunAt: scheduledFor,
      },
      now,
    );

    expect(mockJobService.createJobService).toHaveBeenCalledTimes(1);
    expect(mockExecutionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TRIGGERED" }),
    );
  });
});
