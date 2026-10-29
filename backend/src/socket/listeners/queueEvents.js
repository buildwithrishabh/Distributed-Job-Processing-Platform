const { QueueEvents } = require("bullmq");
const bullMQConnection = require("../../config/queueConnection");
const { QUEUE_NAME } = require("../../queues/job.queue");
const Job = require("../../models/job");
const logger = require("../../utils/logger");

const startQueueEventListener = (io) => {
  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: bullMQConnection,
  });

  // 1. Job started processing
  queueEvents.on("active", async ({ jobId }) => {
    try {
      const dbJob = await Job.findOne({ jobId }).select("userId type status");
      if (dbJob?.userId) {
        io.to(`user:${dbJob.userId}`).emit("job:updated", {
          jobId,
          status: "PROCESSING",
        });
      }
      io.to(`job:${jobId}`).emit("job:state", { jobId, status: "PROCESSING" });
    } catch (err) {
      logger.error({ err, jobId }, "[QueueEvents] Error handling active event");
    }
  });

  // 2. Real-time progress updated (e.g. 25% , 50% , 100%)
  queueEvents.on("progress", ({ jobId, data }) => {
    // Progress emitted to clients currently inspecting this job
    io.to(`job:${jobId}`).emit("job:progress", { jobId, progress: data });
  });

  // 3. Job completed successfully
  queueEvents.on("completed", async ({ jobId, returnvalue }) => {
    try {
      const dbJob = await Job.findOne({ jobId }).select(
        "userId completedAt status",
      );
      if (dbJob?.userId) {
        io.to(`user:${dbJob.userId}`).emit("job:updated", {
          jobId,
          status: "COMPLETED",
          completedAt: dbJob.completedAt,
        });
      }
      io.to(`job:${jobId}`).emit("job:completed", {
        jobId,
        status: "COMPLETED",
        result: returnvalue,
      });
    } catch (error) {
      logger.error(
        { error, jobId },
        "[QueueEvents] Error handling completed event",
      );
    }
  });

  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    try {
      const dbJob = await Job.findOne({ jobId }).select(
        "userId status attempts maxAttempts",
      );

      // Stop if the job does not exist in the database
      if (!dbJob) {
        logger.warn(
          { jobId },
          "[QueueEvents] Failed event received for unknown job",
        );
        return;
      }

      if (dbJob.userId) {
        io.to(`user:${dbJob.userId}`).emit("job:updated", {
          jobId,
          status: dbJob.status || "FAILED",
          attempts: dbJob.attempts,
          error: failedReason,
        });
      }

      // Emit only when the database job exists
      io.to(`job:${jobId}`).emit("job:failed", {
        jobId,
        status: dbJob.status || "FAILED",
        reason: failedReason,
      });
    } catch (err) {
      logger.error({ err, jobId }, "[QueueEvents] Error handling failed event");
    }
  });

  logger.info("[QueueEvents] BullMQ queue event listener started");

  // Return cleanup function for graceful shutdown
  return async () => {
    logger.info("[QueueEvents] Closing queue event listener");

    await queueEvents.close();

    logger.info("[QueueEvents] Queue event listener closed");
  };
};

module.exports = { startQueueEventListener };
