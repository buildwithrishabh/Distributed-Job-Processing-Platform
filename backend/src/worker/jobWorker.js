const { Worker } = require("bullmq");
const bullMQConnection = require("../config/queueConnection");
const { QUEUE_NAME } = require("../queues/job.queue");
const Job = require("../models/job");
const { JOB_STATUS } = require("../config/constant");
const { processJobDispatch } = require("../processors");
const { withTimeout } = require("../utils/timeout");

const JOB_TIMEOUT_MS = 15000; // 15 Seconds Max Execution Time

const createJobWorker = (workerId = "worker_1", concurrency = 5) => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { jobId, type, payload } = job.data;
      console.log(
        `[${workerId}] Starting processing for job: ${jobId} (Type: ${type})`,
      );

      // Check MongoDb for existing Job state
      const dbJob = await Job.findOne({ jobId });

      // If Job i cancelled or deleted, skip execution immediately
      if (!dbJob) {
        console.log(`[${workerId}] Job ${jobId} not found in DB. Skipping.`);
        return { skipped: true, reason: "Job not found in database" };
      }

      if (dbJob.status === JOB_STATUS.CANCELLED) {
        console.log(
          `[${workerId}] Job ${jobId} was CANCELLED by user. Skipping execution.`,
        );
        return { skipped: true, reason: "Job was cancelled by user" };
      }

      // Atomic update to PROCESSING (only if status is NOT CANCELLED)
      const processingDb = await Job.findOneAndUpdate(
        {
          jobId,
          status: { $ne: JOB_STATUS.CANCELLED },
        },
        {
          status: JOB_STATUS.PROCESSING,
          startedAt: new Date(),
          $inc: { attempts: 1 },
        },
        { new: true },
      );

      if (!processingDb) {
        console.log(
          `[${workerId}] Job ${jobId} status changed during lock. Skipping.`,
        );
        return { skipped: true, reason: "Job status changed before execution" };
      }

      console.log(
        `[${workerId}] Processing job ${jobId} with payload:`,
        payload,
      );

      // Execute dispatch to matched job processor strategy with timeout wrapper
      const result = await withTimeout(
        processJobDispatch(type, payload, job),
        JOB_TIMEOUT_MS,
      );

      await Job.findOneAndUpdate(
        {
          jobId,
        },
        {
          status: JOB_STATUS.COMPLETED,
          completedAt: new Date(),
        },
      );

      console.log(`[${workerId}] Completed job: ${jobId}`);
      return { success: true, jobId, result };
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

    console.error(
      `[${workerId}] Job ${jobId} failed (Attempt ${attemptsMade}/${maxAttempts}, Unrecoverable: ${isUnrecoverable}). Status: ${newStatus}`,
    );

    await Job.findOneAndUpdate(
      { jobId },
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
    console.error(`[${workerId}] Internal worker error:`, err.message);
  });
  return worker;
};

module.exports = { createJobWorker };
