const client = require("prom-client");
const { jobQueue } = require("../queues/job.queue");
const { getActiveWorker } = require("./heartBeat");

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
  updateDynamicGauges,
};
