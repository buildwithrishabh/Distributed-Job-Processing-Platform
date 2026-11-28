const ScheduleExecution = require("../models/scheduleExecution");
const Schedule = require("../models/schedule");
const { createJobService } = require("../services/jobService");
const {
  SCHEDULE_STATUS,
  SCHEDULE_TYPES,
  MISFIRE_POLICY,
} = require("../config/constant");
const { acquireLock, releaseLock } = require("../utils/lock");
const logger = require("../utils/logger");
const { computeNextRunAt } = require("../utils/cronHelper");

const POLL_INTERVAL_MS = 5000; // Poll in every 5 seconds
const MISFIRE_THRESHOLD_MS = 60 * 1000; // 1 minutee se zyada late = misfire
const LOCK_TTL_SECONDS = 15;

async function triggerSingleSchedule(schedule, now) {
  const lockKey = `scheduler:schedule:${schedule.scheduleId}`;
  const lockToken = await acquireLock(lockKey, LOCK_TTL_SECONDS);

  if (!lockToken) {
    return;
  }

  const scheduledFor = schedule.nextRunAt;

  try {
    const isOnce = schedule.scheduleType === SCHEDULE_TYPES.ONCE;
    const nextRun = isOnce
      ? null
      : computeNextRunAt(
          schedule.cronExpression,
          schedule.timezone || "UTC",
          now,
        );

    const isMisFire =
      now.getTime() - scheduledFor.getTime() > MISFIRE_THRESHOLD_MS;
    const shouldSkip =
      isMisFire && schedule.misfirePolicy === MISFIRE_POLICY.SKIP;

    // 1. Atomic Claim FIRST
    const claimed = await Schedule.findOneAndUpdate(
      {
        _id: schedule._id,
        status: SCHEDULE_STATUS.ACTIVE,
        nextRunAt: scheduledFor,
      },
      {
        $set: {
          nextRunAt: nextRun,
          lastRunAt: now,
          ...(isOnce ? { status: SCHEDULE_STATUS.COMPLETED } : {}),
        },
        ...(!shouldSkip ? { $inc: { runCount: 1 } } : {}),
      },
      { new: true },
    );

    if (!claimed) {
      return;
    }

    // 2. Misfire SKIP handling
    if (shouldSkip) {
      await ScheduleExecution.create({
        scheduleId: schedule.scheduleId,
        userId: schedule.userId,
        scheduledFor,
        triggeredAt: now,
        status: "SKIPPED",
        error: "Skipped due to misfire policy",
      });
      logger.warn(
        { scheduleId: schedule.scheduleId, scheduledFor },
        "[Scheduler] Missed schedule skipped",
      );
      return;
    }

    // 3. Deterministic idempotencyKey + job creation
    const idempotencyKey = `sched:${schedule.scheduleId}:${scheduledFor.toISOString()}`;

    const job = await createJobService({
      userId: schedule.userId,
      type: schedule.jobType,
      payload: schedule.payload,
      priority: schedule.priority,
      maxAttempts: schedule.maxAttempts,
      scheduleId: schedule.scheduleId,
      scheduledFor,
      idempotencyKey,
    });

    await Schedule.findByIdAndUpdate(schedule._id, {
      $set: {
        lastJobId: job.jobId,
      },
    });

    await ScheduleExecution.create({
      scheduleId: schedule.scheduleId,
      userId: schedule.userId,
      jobId: job.jobId,
      scheduledFor,
      triggeredAt: now,
      status: "TRIGGERED",
    });
  } catch (err) {
    logger.error(
      {
        err,
        scheduleId: schedule.scheduleId,
      },
      "[Scheduler] Failed to trigger schedule",
    );

    await Schedule.findByIdAndUpdate(schedule._id, {
      $inc: { failureCount: 1 },
    }).catch(() => {});

    await ScheduleExecution.create({
      scheduleId: schedule.scheduleId,
      userId: schedule.userId,
      scheduledFor,
      triggeredAt: now,
      status: "FAILED",
      error: err.message,
    }).catch(() => {});
  } finally {
    await releaseLock(lockKey, lockToken).catch(() => {});
  }
}

async function processDueSchedules() {
  const now = new Date();

  try {
    const dueSchedules = await Schedule.find({
      status: SCHEDULE_STATUS.ACTIVE,
      nextRunAt: { $lte: now },
    })
      .sort({ nextRunAt: 1 })
      .limit(50);

    for (const schedule of dueSchedules) {
      await triggerSingleSchedule(schedule, now);
    }
  } catch (err) {
    logger.error({ err }, "[Scheduler] Polling error");
  }
}

function startScheduler() {
  let isRunning = false;
  let timerId = null;
  let stopped = false;

  const tick = async () => {
    if (stopped || isRunning) return;

    isRunning = true;

    try {
      await processDueSchedules();
    } finally {
      isRunning = false;

      if (!stopped) {
        timerId = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }
  };

  tick();

  return function stopScheduler() {
    stopped = true;

    if (timerId) {
      clearTimeout(timerId);
    }
  };
}

module.exports = {
  startScheduler,
  processDueSchedules,
  triggerSingleSchedule,
};
