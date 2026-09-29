const Job = require("../models/job");
const { addJobToQueue } = require("../queues/job.queue");
const { JOB_STATUS } = require("../config/constant");
const {saveIdempotencyKey } = require("../middleware/idempotency");

const createJobService = async ({
  type,
  payload,
  priority = 0,
  maxAttempts = 3,
  idempotencyKey = null,
  idempotencyRedisKey = null,
  userId = null,
}) => {

  if (!userId) {
    const error = new Error("User ID is required to create a job");
    error.statusCode = 401;
    throw error;
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const DbJob = await Job.create({
    jobId,
    type,
    payload: payload || {},
    status: JOB_STATUS.PENDING,
    priority,
    maxAttempts,
    ...(idempotencyKey ? { idempotencyKey } : {}), // comes from header sent by client (only stored if provided)
    userId,
  });

  if (idempotencyRedisKey) {
    await saveIdempotencyKey(idempotencyRedisKey , jobId)
  }

  await addJobToQueue(DbJob);

  return DbJob;
};

const getJobService = async ({ page = 1, limit = 10, status , userId }) => {
  const query  = {userId };
  if (status) query.status = status;
  
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(query),
  ]);
  return { jobs, total, page: Number(page), limit: Number(limit) };
};

const getJobByIdService = async (jobId , userId) => {
  const job = await Job.findOne({ jobId , userId });
  return job;
};

const cancelJobService = async (jobId , userId) => {
  const job = await Job.findOne({ jobId , userId });
  if (!job) return null;
  if (job.status !== JOB_STATUS.PENDING) {
    const error = new Error(`Cannot cancel job in ${job.status} status`);
    error.statusCode = 400;
    throw error;
  }

  job.status = JOB_STATUS.CANCELLED;
  job.error = { message: "Cancelled by user request", failedAt: new Date() };
  job.failedAt = new Date();
  await job.save();

  return job;
};

module.exports = {
  createJobService,
  getJobService,
  getJobsService: getJobService,
  getJobByIdService,
  cancelJobService,
};