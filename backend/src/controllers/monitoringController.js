const monitoringService = require("../services/monitoringService");

const getQueueMetrics = async (req, res, next) => {
  try {
    const metrics = await monitoringService.getQueueMetricsService();
    return res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

const getJobStats = async (req, res, next) => {
  try {
    const stats = await monitoringService.getJobStatsService();
    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};


const getWorkerMetrics = async (req, res, next) => {
  try {
    const workers = await monitoringService.getWorkerMetricsService();
    return res.status(200).json(workers);
  } catch (error) {
    next(error);
  }
};

const getOverviewMetrics = async (req, res, next) => {
    try {
        const [queue , jobs , workers] = await Promise.all([
            monitoringService.getQueueMetricsService(),
            monitoringService.getJobStatsService(),
            monitoringService.getWorkerMetricsService(),
        ])

        return res.status(200).json({
            timestamp : new Date().toISOString(),
            queue,
            jobs,
            workers,
        })
    } catch (error) {
        next(error);
    }
}


module.exports = {
  getQueueMetrics,
  getJobStats,
  getWorkerMetrics,
  getOverviewMetrics
};
