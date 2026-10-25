const Job = require("../models/job");
const { jobQueue, addJobToQueue } = require("../queues/job.queue");
const { JOB_STATUS } = require("../config/constant");

const SWEEPER_INTERVAL_MS = 2 * 60 * 1000; // every 2 minuteus

async function recoverOrphanJobs() {
  try {
    const fiveMinutes = new Date(Date.now() - 5 * 60 * 1000);

    // Jobs that have been pending for more than 5 minutes
    const stuckJobs = await Job.find({
      status: JOB_STATUS.PENDING,
      createdAt: { $lt: fiveMinutes },
    }).limit(50);

    for (const job of stuckJobs) {
      try {
        const bullJob = await jobQueue.getJob(job.jobId);

        if (!bullJob) {
          console.warn(
            `[Sweeper] Found orphan job ${job.jobId}. Re-enqueuing...`,
          );
          await addJobToQueue(job);
        }
      } catch (error) {
        console.error(
          `[Sweeper] Failed to recover job ${job.jobId}:`,
          error.message,
        );
      }
    }
  } catch (error) {
    console.error("[Sweeper] Error in orphan job sweeper run:", error.message);
  }
}

function startOrphanJobSweeper() {
  recoverOrphanJobs();

  const intervalid = setInterval(recoverOrphanJobs, SWEEPER_INTERVAL_MS);

  return function stopSweeper() {
    clearInterval(intervalid);
  };
}

module.exports = {
  recoverOrphanJobs,
  startOrphanJobSweeper,
};
