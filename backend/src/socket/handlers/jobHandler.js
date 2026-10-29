const Job = require("../../models/job");
const logger = require("../../utils/logger");

const registerJobHandlers = (io, socket) => {
  socket.on("job:subscribe", async (jobId) => {
    try {
      if (typeof jobId !== "string" || !mongoose.isObjectIdOrHexString(jobId)) {
        return socket.emit("job:error", {
          message: "Invalid job ID",
        });
      }

      // Check whether the job belongs to the logged-in user
      const job = await Job.findOne({
        _id: jobId,
        userId: socket.user._id,
      }).select("_id");

      if (!job) {
        return socket.emit("job:error", {
          message: "Job not found or access denied",
        });
      }

      // Authorized: allow joining the job room
      socket.join(`job:${job._id}`);
    } catch (error) {
      logger.error({ err: error }, "Job subscription failed");

      socket.emit("job:error", {
        message: "Unable to subscribe to job",
      });
    }
  });

  socket.on("job:unsubscribe", (jobId) => {
    if (typeof jobId !== "string" || !mongoose.isObjectIdOrHexString(jobId)) {
      return;
    }
    socket.leave(`job:${jobId}`);
  });
};

module.exports = { registerJobHandlers };
