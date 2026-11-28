const client = require("prom-client");
const mongoose = require("mongoose");
const { jobQueue } = require("../queues/job.queue");
const { getActiveWorker } = require("./heartBeat");
const Schedule = require("../models/schedule");
const { SCHEDULE_STATUS } = require("../config/constant");

// create a Registry
const register = new client.Registry();

// 2. Enable default node.js system metrics (Heap , Event , loop lag , CPU etc).
client.collectDefaultMetrics({ register, prefix: "job_platform_" });

// HTTP Metrics
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

register.registerMetric(httpRequestDuration);

const httpRequestTotal = new client.Counter({
  name: "http_request_total",
  help: "Total Number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

register.registerMetric(httpRequestTotal);

// --- BullMQ & Worker Custom Metrics ---
const queueJobCount = new client.Gauge({
  name: "bullmq_queue_jobs_count",
  help: "Number of jobs in the queue grouped by state",
  labelNames: ["queue", "state"], // state: waiting, active, delayed, failed, completed
});
register.registerMetric(queueJobCount);

const activeWorkersCount = new client.Gauge({
  name: "job_platform_active_workers_count",
  help: "Number of currently active worker instances",
});
register.registerMetric(activeWorkersCount);

const jobExecutionDuration = new client.Histogram({
  name: "job_execution_duration_seconds",
  help: "Duration of job processing in seconds",
  labelNames: ["job_type", "status"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 15],
});
register.registerMetric(jobExecutionDuration);

const jobsProcessedTotal = new client.Counter({
  name: "jobs_processed_total",
  help: "Total count of jobs processed by workers",
  labelNames: ["job_type", "status"], // status: completed, failed, dead, skipped
});
register.registerMetric(jobsProcessedTotal);

// --- Scheduler Custom Metrics ---
const schedulerTriggersTotal = new client.Counter({
  name: "scheduler_triggers_total",
  help: "Total number of schedule trigger attempts",
  labelNames: ["status"], // triggered, skipped, failed
});
register.registerMetric(schedulerTriggersTotal);

const schedulerTickDuration = new client.Histogram({
  name: "scheduler_tick_duration_seconds",
  help: "Duration of scheduler polling ticks in seconds",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5],
});
register.registerMetric(schedulerTickDuration);

const schedulerTriggerLag = new client.Histogram({
  name: "scheduler_trigger_lag_seconds",
  help: "Delay between scheduledFor and actual trigger time in seconds",
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});
register.registerMetric(schedulerTriggerLag);

const schedulerSchedulesCount = new client.Gauge({
  name: "scheduler_schedules_count",
  help: "Number of schedules grouped by status",
  labelNames: ["status"],
});
register.registerMetric(schedulerSchedulesCount);

// Function to refresh dynamic queue and worker gauges before scrape 
const updateDynamicGauges = async () => {
  try {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      jobQueue.getWaitingCount(),
      jobQueue.getActiveCount(),
      jobQueue.getDelayedCount(),
      jobQueue.getFailedCount(),
      jobQueue.getCompletedCount(),
    ]);

    queueJobCount.set({ queue: jobQueue.name, state: "waiting" }, waiting);
    queueJobCount.set({ queue: jobQueue.name, state: "active" }, active);
    queueJobCount.set({ queue: jobQueue.name, state: "delayed" }, delayed);
    queueJobCount.set({ queue: jobQueue.name, state: "failed" }, failed);
    queueJobCount.set({ queue: jobQueue.name, state: "completed" }, completed);

    const workers = await getActiveWorker();
    activeWorkersCount.set(Array.isArray(workers) ? workers.length : 0);

    if (mongoose.connection.readyState === 1) {
      const scheduleStats = await Schedule.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const counts = Object.fromEntries(
        Object.values(SCHEDULE_STATUS).map((s) => [s, 0]),
      );
      for (const item of scheduleStats) {
        counts[item._id] = item.count;
      }
      for (const [status, count] of Object.entries(counts)) {
        schedulerSchedulesCount.set({ status }, count);
      }
    }
  } catch (err) {
    // Fail silently if queue or redis is connecting
  }
};

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  queueJobCount,
  activeWorkersCount,
  jobExecutionDuration,
  jobsProcessedTotal,
  schedulerTriggersTotal,
  schedulerTickDuration,
  schedulerTriggerLag,
  schedulerSchedulesCount,
  updateDynamicGauges,
};
