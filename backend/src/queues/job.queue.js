const { Queue } = require("bullmq");
const env = require("../config/env");
const redisClient = require("../config/redis");

const QUEUE_NAME = "job-queue";

// Instantiate the BullMQ Queue
const jobQueue = new Queue(QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000, // max 1000 jobs
    },
    removeOnFail: {
      age: 86400, // 24 hours
      count: 5000, // max 5000 jobs
    },
  },
});

async function addJobToQueue(jobRecord) {
  const options = {
    jobId: jobRecord.jobId,
    attempts: jobRecord.maxAttempts || 3,
    priority: jobRecord.priority ?? 0,
  };

  const bullJob = await jobQueue.add(
    jobRecord.type,
    {
      mongoId: jobRecord._id ? jobRecord._id.toString() : null,
      jobId: jobRecord.jobId,
      type: jobRecord.type,
      payload: jobRecord.payload,
    },
    options
  );

  return bullJob;
}

module.exports = {
  QUEUE_NAME,
  jobQueue,
  addJobToQueue,
};
