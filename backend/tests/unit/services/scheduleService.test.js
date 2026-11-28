import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const mockScheduleModel = {
  create: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  deleteOne: vi.fn(),
};

const mockExecutionModel = {
  find: vi.fn(),
  countDocuments: vi.fn(),
  deleteMany: vi.fn(),
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

delete require.cache[require.resolve("../../../src/services/scheduleService")];
const {
  createScheduleService,
  getSchedulesService,
  pauseScheduleService,
  resumeScheduleService,
  cancelScheduleService,
  deleteScheduleService,
} = require("../../../src/services/scheduleService");
const { SCHEDULE_STATUS, SCHEDULE_TYPES } = require("../../../src/config/constant");

describe("Service: scheduleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ONCE schedule with nextRunAt equal to runAt", async () => {
    const runAt = new Date(Date.now() + 60_000).toISOString();
    mockScheduleModel.create.mockImplementation(async (doc) => doc);

    const result = await createScheduleService({
      userId: "user_1",
      name: "One-time email",
      jobType: "email",
      payload: { to: "a@b.com", subject: "Hi" },
      scheduleType: SCHEDULE_TYPES.ONCE,
      runAt,
      priority: 1,
      maxAttempts: 3,
    });

    expect(result.scheduleId).toMatch(/^sched_/);
    expect(result.status).toBe(SCHEDULE_STATUS.ACTIVE);
    expect(result.nextRunAt.toISOString()).toBe(new Date(runAt).toISOString());
  });

  it("creates a RECURRING schedule and computes future nextRunAt", async () => {
    mockScheduleModel.create.mockImplementation(async (doc) => doc);

    const result = await createScheduleService({
      userId: "user_1",
      name: "Every 5 mins",
      jobType: "email",
      payload: { to: "a@b.com", subject: "Hi" },
      scheduleType: SCHEDULE_TYPES.RECURRING,
      cronExpression: "*/5 * * * *",
      timezone: "Asia/Kolkata",
    });

    expect(result.nextRunAt).toBeInstanceOf(Date);
    expect(result.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns paginated schedules", async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ scheduleId: "sched_1" }]),
    };
    mockScheduleModel.find.mockReturnValue(chain);
    mockScheduleModel.countDocuments.mockResolvedValue(1);

    const res = await getSchedulesService({ userId: "user_1", page: 1, limit: 10 });
    expect(res.schedules).toHaveLength(1);
    expect(res.pagination.total).toBe(1);
  });

  it("pauses an ACTIVE schedule and rejects pausing a PAUSED one", async () => {
    const doc = {
      scheduleId: "sched_1",
      status: SCHEDULE_STATUS.ACTIVE,
      save: vi.fn().mockResolvedValue(true),
    };
    mockScheduleModel.findOne.mockResolvedValue(doc);

    const paused = await pauseScheduleService("sched_1", "user_1");
    expect(paused.status).toBe(SCHEDULE_STATUS.PAUSED);

    await expect(pauseScheduleService("sched_1", "user_1")).rejects.toThrow(/Cannot pause/);
  });

  it("resumes a PAUSED recurring schedule with a fresh nextRunAt", async () => {
    const doc = {
      scheduleId: "sched_1",
      scheduleType: SCHEDULE_TYPES.RECURRING,
      cronExpression: "*/5 * * * *",
      timezone: "UTC",
      status: SCHEDULE_STATUS.PAUSED,
      nextRunAt: null,
      save: vi.fn().mockResolvedValue(true),
    };
    mockScheduleModel.findOne.mockResolvedValue(doc);

    const resumed = await resumeScheduleService("sched_1", "user_1");
    expect(resumed.status).toBe(SCHEDULE_STATUS.ACTIVE);
    expect(resumed.nextRunAt).toBeInstanceOf(Date);
  });

  it("rejects resuming a ONCE schedule whose runAt has already passed", async () => {
    const doc = {
      scheduleId: "sched_1",
      scheduleType: SCHEDULE_TYPES.ONCE,
      runAt: new Date(Date.now() - 10_000),
      status: SCHEDULE_STATUS.PAUSED,
    };
    mockScheduleModel.findOne.mockResolvedValue(doc);

    await expect(resumeScheduleService("sched_1", "user_1")).rejects.toThrow(/already passed/);
  });

  it("cancels an ACTIVE schedule and clears nextRunAt", async () => {
    const doc = {
      scheduleId: "sched_1",
      status: SCHEDULE_STATUS.ACTIVE,
      nextRunAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
    };
    mockScheduleModel.findOne.mockResolvedValue(doc);

    const cancelled = await cancelScheduleService("sched_1", "user_1");
    expect(cancelled.status).toBe(SCHEDULE_STATUS.CANCELLED);
    expect(cancelled.nextRunAt).toBeNull();
  });

  it("requires schedule to be CANCELLED/COMPLETED before deleting", async () => {
    mockScheduleModel.findOne.mockResolvedValue({
      _id: "mongo_1",
      scheduleId: "sched_1",
      status: SCHEDULE_STATUS.ACTIVE,
    });
    await expect(deleteScheduleService("sched_1", "user_1")).rejects.toThrow(/Cancel the schedule/);

    mockScheduleModel.findOne.mockResolvedValue({
      _id: "mongo_1",
      scheduleId: "sched_1",
      status: SCHEDULE_STATUS.CANCELLED,
    });
    mockExecutionModel.deleteMany.mockResolvedValue({ deletedCount: 2 });
    mockScheduleModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const deleted = await deleteScheduleService("sched_1", "user_1");
    expect(deleted.scheduleId).toBe("sched_1");
    expect(mockExecutionModel.deleteMany).toHaveBeenCalledWith({
      scheduleId: "sched_1",
      userId: "user_1",
    });
  });
});
