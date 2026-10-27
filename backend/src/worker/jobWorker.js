const { Worker } = require("bullmq");
const bullMQConnection = require("../config/queueConnection");
const { QUEUE_NAME } = require("../queues/job.queue");
const Job = require("../models/job");
const { JOB_STATUS } = require("../config/constant");
const { processJobDispatch } = require("../processors");
const { withTimeout } = require("../utils/timeout");
const { acquireLock, releaseLock } = require("../utils/lock");
const logger = require("../utils/logger");

const JOB_TIMEOUT_MS = 15000; // 15 Seconds Max Execution Time

const createJobWorker = (workerId, concurrency = 5) => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { jobId, type, payload } = job.data;
      const jobLog = logger.child({ workerId, jobId, type });

      jobLog.info("Starting processing for job");

      const lockToken = await acquireLock(`worker:job:${jobId}`, 20);
      if (!lockToken) {
        jobLog.warn("Job is already being processed by another worker. Skipping.");
        throw new Error(`Could not acquire lock for job: ${jobId}`);
      }

      try {
        // Check MongoDb for existing Job state
        const dbJob = await Job.findOne({ jobId });

        // If Job cancelled or deleted, skip execution immediately
        if (!dbJob) {
          jobLog.info("Job not found in DB. Skipping.");
          return { skipped: true, reason: "Job not found in database" };
        }

        // IF Job already completed to skip the job
        if (dbJob.status === JOB_STATUS.COMPLETED) {
          jobLog.info("Job already Completed. Skipping.");
          return { skipped: true, reason: "Job already completed" };
        }

        if (dbJob.status === JOB_STATUS.CANCELLED) {
          jobLog.info("Job was CANCELLED by user. Skipping execution.");
          return { skipped: true, reason: "Job was cancelled by user" };
        }

        // Atomic update to PROCESSING (only allow from PENDING or RETRYING)
        const processingDb = await Job.findOneAndUpdate(
          {
            jobId,
            status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRYING] },
          },
          {
            status: JOB_STATUS.PROCESSING,
            startedAt: new Date(),
            $inc: { attempts: 1 },
          },
          { new: true },
        );

        if (!processingDb) {
          jobLog.warn("Job status changed during lock. Skipping.");
          return {
            skipped: true,
            reason: "Job status changed before execution",
          };
        }

        jobLog.debug({ payload }, "Processing job with payload");

        // Execute dispatch to matched job processor strategy with timeout wrapper
        const result = await withTimeout((signal) => 
          processJobDispatch(type, payload, job , signal ),
          JOB_TIMEOUT_MS,
        );

        await Job.findOneAndUpdate(
          {
            jobId,
            status: JOB_STATUS.PROCESSING,
          },
          {
            status: JOB_STATUS.COMPLETED,
            completedAt: new Date(),
          },
        );

        jobLog.info("Completed job successfully");
        return { success: true, jobId, result };
      } finally {
        // Release the lock
        await releaseLock(`worker:job:${jobId}`, lockToken);
      }
    },
    {
      connection: bullMQConnection,
      concurrency,
    },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId } = job.data;
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 3;

    const isUnrecoverable =
      err.name === "UnrecoverableError" || Boolean(err.unrecoverable);
    const isDead = attemptsMade >= maxAttempts || isUnrecoverable;
    const newStatus = isDead ? JOB_STATUS.DEAD : JOB_STATUS.RETRYING;

    logger.error(
      {
        workerId,
        jobId,
        attemptsMade,
        maxAttempts,
        isUnrecoverable,
        status: newStatus,
        err,
      },
      `[${workerId}] Job ${jobId} failed (Attempt ${attemptsMade}/${maxAttempts}). Status: ${newStatus}`
    );

    await Job.findOneAndUpdate(
      {
        jobId,
        status: { $nin: [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED] },
      },
      {
        status: newStatus,
        failedAt: new Date(),
        error: {
          message: err.message,
          stack: err.stack,
          failedAt: new Date(),
        },
      },
    );
  });

  worker.on("error", (err) => {
    logger.error({ workerId, err }, `[${workerId}] Internal worker error: ${err.message}`);
  });
  return worker;
};

module.exports = { createJobWorker };
