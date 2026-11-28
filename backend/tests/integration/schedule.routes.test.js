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

const mockUserModel = {
  findById: vi.fn(),
};

const mockQueue = {
  addJobToQueue: vi.fn(),
  jobQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getDelayedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(0),
    name: "job-queue",
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

require.cache[require.resolve("../../src/models/schedule")] = {
  id: require.resolve("../../src/models/schedule"),
  filename: require.resolve("../../src/models/schedule"),
  loaded: true,
  exports: mockScheduleModel,
};

require.cache[require.resolve("../../src/models/scheduleExecution")] = {
  id: require.resolve("../../src/models/scheduleExecution"),
  filename: require.resolve("../../src/models/scheduleExecution"),
  loaded: true,
  exports: mockExecutionModel,
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
const { SCHEDULE_STATUS, SCHEDULE_TYPES } = require("../../src/config/constant");
const { TEST_USER, createTestToken } = require("./helpers");

describe("Integration: Schedule Routes (/api/schedules)", () => {
  const token = createTestToken(TEST_USER);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(TEST_USER),
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/schedules");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid cron expression on RECURRING schedule", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Bad Cron",
        jobType: "email",
        payload: { to: "a@b.com", subject: "Hi" },
        scheduleType: SCHEDULE_TYPES.RECURRING,
        cronExpression: "invalid cron",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation Error");
  });

  it("creates a RECURRING schedule with 201", async () => {
    mockScheduleModel.create.mockImplementation(async (doc) => doc);

    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Daily Digest",
        jobType: "email",
        payload: { to: "a@b.com", subject: "Digest" },
        scheduleType: SCHEDULE_TYPES.RECURRING,
        cronExpression: "0 9 * * *",
        timezone: "Asia/Kolkata",
      });

    expect(res.status).toBe(201);
    expect(res.body.schedule.name).toBe("Daily Digest");
    expect(res.body.schedule.status).toBe(SCHEDULE_STATUS.ACTIVE);
  });

  it("lists schedules with pagination", async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ scheduleId: "sched_1", name: "Test" }]),
    };
    mockScheduleModel.find.mockReturnValue(chain);
    mockScheduleModel.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get("/api/schedules?page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.schedules).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it("pauses and resumes a schedule", async () => {
    const doc = {
      scheduleId: "sched_1",
      scheduleType: SCHEDULE_TYPES.RECURRING,
      cronExpression: "*/5 * * * *",
      timezone: "UTC",
      status: SCHEDULE_STATUS.ACTIVE,
      save: vi.fn().mockResolvedValue(true),
    };
    mockScheduleModel.findOne.mockResolvedValue(doc);

    const pauseRes = await request(app)
      .post("/api/schedules/sched_1/pause")
      .set("Authorization", `Bearer ${token}`);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.schedule.status).toBe(SCHEDULE_STATUS.PAUSED);

    const resumeRes = await request(app)
      .post("/api/schedules/sched_1/resume")
      .set("Authorization", `Bearer ${token}`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.schedule.status).toBe(SCHEDULE_STATUS.ACTIVE);
  });

  it("returns 404 when schedule is not found", async () => {
    mockScheduleModel.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/schedules/nonexistent")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
