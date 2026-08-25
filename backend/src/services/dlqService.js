const Job = require("../models/job");
const { addJobToQueue } = require("../queues/job.queue");
const { JOB_STATUS } = require("../config/constant");

const getDeadJobService = async ( { page = 1 , limit = 10}) => {
    const skip = (page - 1 ) * limit;

    const [ jobs , total ] = await Promise.all([
        Job.find({ status: JOB_STATUS.DEAD}).sort({ failedAt: -1 }).skip(skip).limit(limit),
        Job.countDocuments({ status: JOB_STATUS.DEAD})
    ]);

    return { jobs , total  , page: Number(page) , limit: Number(limit)}
}


const retryDeadJobService = async(JobId) => {
    const job = await Job.findOne({ jobId: JobId });

    if(!job){
        throw new Error("Job not found")
    }

    if (job.status !== JOB_STATUS.DEAD && job.status !== JOB_STATUS.FAILED) {
        throw new Error(`Job is not in dead or failed state, current state: ${job.status}`)
    }

    job.status = JOB_STATUS.PENDING;
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;
    await job.save();


    // Re-Enqueue into BullMQ Queue
    await addJobToQueue({
        jobId: job.jobId,
        type: job.type,
        payload: job.payload,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
    });

    return job;
}


module.exports = {
    getDeadJobService,
    retryDeadJobService,
}