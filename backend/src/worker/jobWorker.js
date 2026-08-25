const { Worker } = require("bullmq");
const redisClient = require("../config/redis");
const { QUEUE_NAME } = require("../queues/job.queue");
const Job = require("../models/job");
const { JOB_STATUS } = require("../config/constant");
const { processJobDispatch } = require("../processors");

const createJobWorker = (workerId = "worker_1", concurrency = 5) => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { jobId, type, payload } = job.data;
      console.log(
        `[${workerId}] Starting processing for job: ${jobId} (Type: ${type})`,
      );

      // Mark as PROCESSING in MongoDB & increment attempt counter
      await Job.findOneAndUpdate(
        {
          jobId,
        },
        {
          status: JOB_STATUS.PROCESSING,
          startedAt: new Date(),
          $inc: { attempts: 1 },
        },
      );

      console.log(
        `[${workerId}] Processing job ${jobId} with payload:`,
        payload,
      );

      // Execute dispatch to matched job processor strategy
      const result = await processJobDispatch(type, payload, job);

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
      connection: redisClient,
      concurrency,
    },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId } = job.data;
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 3;

    const isDead = attemptsMade >= maxAttempts;
    const newStatus = isDead ? JOB_STATUS.DEAD : JOB_STATUS.FAILED;

    console.error(
      `[${workerId}] Job ${jobId} failed (Attempt ${attemptsMade}/${maxAttempts}). Status: ${newStatus}`,
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
