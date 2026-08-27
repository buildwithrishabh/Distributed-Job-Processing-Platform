const Job = require("../models/job");
const { addJobToQueue, jobQueue } = require("../queues/job.queue");
const { JOB_STATUS } = require("../config/constant");
const { acquireLock, releaseLock } = require("../utils/lock");

const getDeadJobService = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    Job.find({ status: JOB_STATUS.DEAD })
      .sort({ failedAt: -1 })
      .skip(skip)
      .limit(limit),
    Job.countDocuments({ status: JOB_STATUS.DEAD }),
  ]);

  return { jobs, total, page: Number(page), limit: Number(limit) };
};

const retryDeadJobService = async (JobId) => {
  // Acqiure Redis lock for 10 seconds to prevent concurrent retries for the same JobId.

  const lockToken = await acquireLock(`dlq:retry:${JobId}`, 10);

  if (!lockToken) {
    const error = new Error(
      "Job Retry is currently being processed by another request",
    );
    error.statusCode = 400;
    throw error;
  }

  try {
    const job = await Job.findOne({ jobId: JobId });

    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }

    if (job.status !== JOB_STATUS.DEAD && job.status !== JOB_STATUS.FAILED) {
      const error = new Error(
        `Job is not in dead or failed state, current state: ${job.status}`,
      );
      error.statusCode = 400;
      throw error;
    }

    job.status = JOB_STATUS.PENDING;
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;
    await job.save();

    // Removing existing failed job from BullMQ if present to allow re-enqueue.
    const existingBullJob = await jobQueue.getJob(job.jobId);
    if (existingBullJob) {
      await existingBullJob.remove();
    }

    // Re-Enqueue into BullMQ Queue
    await addJobToQueue(job);

    return job;
  } finally {
    await releaseLock(`dlq:retry:${JobId}`, lockToken);
  }
};

module.exports = {
  getDeadJobService,
  retryDeadJobService,
};
