const Job = require("../models/job");
const { jobQueue } = require("../queues/jobQueue");
const { getActiveWorker } = require("../utils/heartBeat");

// Queue metrics
const getQueueMetricsService = async () => {
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    jobQueue.getWaitingCount(),
    jobQueue.getActiveCount(),
    jobQueue.getDelayedCount(),
    jobQueue.getFailedCount(),
    jobQueue.getCompletedCount(),
  ]);

  return {
    queueName: jobQueue.name,
    waiting,
    active,
    delayed,
    failed,
    completed,
    totalInMemory: waiting + active + delayed + failed + completed,
  };
};

// Get MongoDB Job statistics grouped by status
const getJobStatsService = async () => {
  const stats = await Job.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const formattedStats = {
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    DEAD: 0,
    total: 0,
  };

  stats.forEach((item) => {
    formattedStats[item._id] = item.count;
    formattedStats.total += item.count;
  });
  return formattedStats;
};

const getWorkerMetricsService = async () => {
  const workers = await getActiveWorker();
  return {
    activeWorkerCount: workers.length,
    workers,
  };
};

module.exports = {
  getQueueMetricsService,
  getJobStatsService,
  getWorkerMetricsService,
};
