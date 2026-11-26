const Schedule = require("../models/schedule");
const ScheduleExecution = require("../models/scheduleExecution");
const {
  SCHEDULE_STATUS,
  SCHEDULE_TYPES,
} = require("../config/constant");
const { computeNextRunAt } = require("../utils/cronHelper");

const createScheduleService = async ({
  userId,
  name,
  jobType,
  payload,
  scheduleType,
  runAt,
  priority,
  maxAttempts,
  cronExpression = null,
  timezone = "UTC"
}) => {
  const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const nextRunAt =
    scheduleType === SCHEDULE_TYPES.ONCE ? new Date(runAt) : computeNextRunAt(cronExpression , timezone, new Date());

  const schedule = await Schedule.create({
    scheduleId,
    userId,
    name,
    jobType,
    payload,
    scheduleType,
    runAt,
    nextRunAt,
    priority,
    maxAttempts,
    status: SCHEDULE_STATUS.ACTIVE,
    cronExpression,
    timezone,
  });

  return schedule;
};

const getSchedulesService = async ({
  userId,
  page = 1,
  limit = 10,
  status,
}) => {
  page = Math.max(1, Number(page));
  limit = Math.max(1, Number(limit));

  const filter = { userId };

  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [schedules, total] = await Promise.all([
    Schedule.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Schedule.countDocuments(filter),
  ]);

  return {
    schedules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getScheduleByIdService = async (scheduleId, userId) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });

  return schedule;
};

const getScheduleExecutionsService = async ({
  scheduleId,
  userId,
  page = 1,
  limit = 10,
}) => {
  const schedule = await Schedule.findOne({ scheduleId, userId }).lean();
  if (!schedule) return null;

  page = Math.max(1, Number(page));
  limit = Math.max(1, Number(limit));
  const skip = (page - 1) * limit;

  const filter = { scheduleId, userId };
  const [executions, total] = await Promise.all([
    ScheduleExecution.find(filter)
      .sort({ triggeredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ScheduleExecution.countDocuments(filter),
  ]);

  return {
    executions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = {
  createScheduleService,
  getSchedulesService,
  getScheduleByIdService,
  getScheduleExecutionsService,
};