const { jobQueue } = require("../queues/jobQueue");
const env = require("../config/env");

const backpressureGuard = async (req, res, next) => {
  try {
    const maxCapacity = env.MAX_QUEUE_CAPACITY;

    // Fetch total waiting and delayed jobs count in Redis
    const waitingCount = await jobQueue.getWaitingCount();

    if (waitingCount > maxCapacity) {
      console.warn(
        `[Backpressure] Queue Overload Detected! Waiting Jobs: ${waitingCount}/${maxCapacity}`,
      );
      res.setHeader("Retry-After", 30); // request producer to wait 30 seconds

      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "Server is currently experiencing high load. Queue Capacity limit reached.",
        currentQueueSize: waitingCount,
        maxCapacity,
      });
    }

    next();
  } catch (error) {
    console.error("[Backpressure] Error checking queue size:", error.message);
    next(); // Fail open if metric check fails
  }
};

module.exports = backpressureGuard;
