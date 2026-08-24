const jobService = require("../services/jobService");

const createJob = async (req, res, next) => {
  try {
    const { type, payload, priority, maxAttempts } = req.body;
    const userId = req.user ? req.user._id : null;

    const job = await jobService.createJobService({
      type,
      payload,
      priority,
      maxAttempts,
      userId,
    });

    return res.status(202).json({
      message: "Job accepted and enqueued",
      job: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getJobs = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await jobService.getJobsService({ page, limit, status });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const job = await jobService.getJobByIdService(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.status(200).json(job);
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const job = await jobService.cancelJobService(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.status(200).json({
      message: "Job cancelled successfully",
      job,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJob,
  getJobs,
  getJob: getJobs,
  getJobById,
  deleteJob,
};
