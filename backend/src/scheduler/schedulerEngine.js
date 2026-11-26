const scheduleExecution = require("../models/scheduleExecution");
const Schedule = require("../models/schedule");
const { createJobService } = require("../services/jobService");
const { SCHEDULE_STATUS, SCHEDULE_TYPES } = require("../config/constant");
const logger = require("../utils/logger");
const { computeNextRunAt } = require("../utils/cronHelper");

const POLL_INTERVAL_MS = 5000; // Poll in every 5 seconds

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
      try {
        const scheduledFor = schedule.nextRunAt;

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

        await scheduleExecution.create({
          scheduleId: schedule.scheduleId,
          userId: schedule.userId,
          jobId: job.jobId,
          scheduledFor,
          triggeredAt: now,
          status: "TRIGGERED",
        });

        // ONCE schedule ko complete karo
        if (schedule.scheduleType === SCHEDULE_TYPES.ONCE) {
          await Schedule.findOneAndUpdate(
            {
              _id: schedule._id,
              status: SCHEDULE_STATUS.ACTIVE,
              nextRunAt: scheduledFor,
            },
            {
              $set: {
                status: SCHEDULE_STATUS.COMPLETED,
                nextRunAt: null,
                lastRunAt: now,
                lastJobId: job.jobId,
              },
              $inc: { runCount: 1 },
            },
          );
        } else {
          const nextRun = computeNextRunAt(
            schedule.cronExpression,
            schedule.timezone || "UTC",
            now,
          );

          await Schedule.findOneAndUpdate(
            {
              _id: schedule._id,
              status: SCHEDULE_STATUS.ACTIVE,
              nextRunAt: scheduledFor,
            },
            {
              $set: {
                nextRunAt: nextRun,
                lastRunAt: now,
                lastJobId: job.jobId,
              },
              $inc: {runCount: 1}
            },
          );
        }
      } catch (err) {
        logger.error(
          { err, scheduleId: schedule.scheduleId },
          "[Scheduler] Failed to trigger schedule",
        );

        await Schedule.findByIdAndUpdate(schedule._id, {
          $inc: { failureCount: 1 },
        });

        await scheduleExecution.create({
          scheduleId: schedule.scheduleId,
          userId: schedule.userId,
          scheduledFor: schedule.nextRunAt,
          triggeredAt: now,
          status: "FAILED",
          error: err.message,
        });
      }
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
};
