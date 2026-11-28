const Schedule = require("../models/schedule");
const ScheduleExecution = require("../models/scheduleExecution");
const { SCHEDULE_STATUS, SCHEDULE_TYPES } = require("../config/constant");
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
  timezone = "UTC",
}) => {
  const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const nextRunAt =
    scheduleType === SCHEDULE_TYPES.ONCE
      ? new Date(runAt)
      : computeNextRunAt(cronExpression, timezone, new Date());

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

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const updateScheduleService = async (scheduleId, userId, updates) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });
  if (!schedule) return null;

  if (
    [SCHEDULE_STATUS.COMPLETED, SCHEDULE_STATUS.CANCELLED].includes(
      schedule.status,
    )
  ) {
    throw badRequest(`Cannot update schedule in ${schedule.status} status`);
  }

  const allowedFields = [
    "name",
    "payload",
    "priority",
    "maxAttempts",
    "misfirePolicy",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      schedule[field] = updates[field];
    }
  }

  const timingChanged =
    updates.runAt !== undefined ||
    updates.cronExpression !== undefined ||
    updates.timezone !== undefined;

  if (timingChanged) {
    if (schedule.scheduleType === SCHEDULE_TYPES.ONCE) {
      const nextRunAt = new Date(updates.runAt || schedule.runAt);
      if (
        Number.isNaN(nextRunAt.getTime()) ||
        nextRunAt.getTime() <= Date.now()
      ) {
        throw badRequest(
          "For ONCE schedules, runAt must be a valid future ISO timestamp",
        );
      }
      schedule.runAt = nextRunAt;
      if (schedule.status === SCHEDULE_STATUS.ACTIVE) {
        schedule.nextRunAt = nextRunAt;
      }
    } else {
      const cronExpr = updates.cronExpression ?? schedule.cronExpression;
      const tz = updates.timezone ?? schedule.timezone;

      let nextRunAt;

      try {
        nextRunAt = computeNextRunAt(cronExpr, tz, new Date());
      } catch {
        throw badRequest("Invalid cronExpression or timezone");
      }
      if (!nextRunAt) {
        throw badRequest("cronExpression produced no future run");
      }
      schedule.cronExpression = cronExpr;
      schedule.timezone = tz;
      if (schedule.status === SCHEDULE_STATUS.ACTIVE) {
        schedule.nextRunAt = nextRunAt;
      }
    }
  }

  await schedule.save();
  return schedule;
};

const pauseScheduleService = async (scheduleId, userId) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });
  if (!schedule) return null;

  if (schedule.status !== SCHEDULE_STATUS.ACTIVE) {
    throw badRequest(`Cannot pause schedule in ${schedule.status} status`);
  }

  schedule.status = SCHEDULE_STATUS.PAUSED;
  await schedule.save();
  return schedule;
};

const resumeScheduleService = async (scheduleId, userId) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });
  if (!schedule) return null;

  if (schedule.status !== SCHEDULE_STATUS.PAUSED) {
    throw badRequest(`Cannot resume schedule in ${schedule.status} status`);
  }

  if (schedule.scheduleType === SCHEDULE_TYPES.ONCE) {
    if (!schedule.runAt || schedule.runAt.getTime() <= Date.now()) {
      throw badRequest(
        "Schedule runAt has already passed; update runAt before resuming",
      );
    }
    schedule.nextRunAt = schedule.runAt;
  } else {
    const nextRunAt = computeNextRunAt(
      schedule.cronExpression,
      schedule.timezone || "UTC",
      new Date(),
    );

    if (!nextRunAt) {
      throw badRequest("Could not compute next run for this cron expression");
    }
    schedule.nextRunAt = nextRunAt;
  }

  schedule.status = SCHEDULE_STATUS.ACTIVE;
  await schedule.save();
  return schedule;
};

const cancelScheduleService = async (scheduleId, userId) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });
  if (!schedule) return null;

  if (
    [SCHEDULE_STATUS.COMPLETED, SCHEDULE_STATUS.CANCELLED].includes(
      schedule.status,
    )
  ) {
    throw badRequest(`Schedule is already ${schedule.status}`);
  }

  schedule.status = SCHEDULE_STATUS.CANCELLED;
  schedule.nextRunAt = null;
  await schedule.save();
  return schedule;
};

const deleteScheduleService = async (scheduleId, userId) => {
  const schedule = await Schedule.findOne({ scheduleId, userId });
  if (!schedule) return null;

  if (
    ![SCHEDULE_STATUS.COMPLETED, SCHEDULE_STATUS.CANCELLED].includes(
      schedule.status,
    )
  ) {
    throw badRequest("Cancel the schedule before deleting it");
  }

  await ScheduleExecution.deleteMany({ scheduleId, userId });
  await Schedule.deleteOne({ _id: schedule._id });
  return schedule;
};

module.exports = {
  createScheduleService,
  getSchedulesService,
  getScheduleByIdService,
  getScheduleExecutionsService,
  updateScheduleService,
  pauseScheduleService,
  resumeScheduleService,
  cancelScheduleService,
  deleteScheduleService,
};
