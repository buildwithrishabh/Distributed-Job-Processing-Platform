const dlqService = require("../services/dlqService");

const getDeadJobs = async (req , res  , next) => {
    try {
        const { page , limit } = req.query;
        const result = await dlqService.getDeadJobService({ page , limit});
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

const retryDeadJob = async (req , res , next) => {
    try {
        const { id } = req.params;
        const retriedJob = await dlqService.retryDeadJobService(id);
        return res.status(200).json({
            message: "Job successfully re-queued for processing",
            job: retriedJob,
        });
    } catch (error) {
        next(error)
    }
}

module.exports = {
    getDeadJobs,
    retryDeadJob,
}