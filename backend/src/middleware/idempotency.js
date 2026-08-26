const  redisClient = require("../config/redis");
const Job = require("../models/job");

const IDEMPOTENCY_PREFIX = "idempotency:";
const DEFAULT_TTL_SECONDS = 86400; // 24 Hours

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey) {
    return next();
  }

  const redisKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;

  try {
    const cachedJobId = await redisClient.get(redisKey);

    if (cachedJobId) {
      console.log(
        `[Idempotency] Duplicate request detected for key: ${idempotencyKey}. Cached JobId: ${cachedJobId}`,
      );

      const existingJob = await Job.findOne({ jobId: cachedJobId });

      if (existingJob) {
        return res.status(200).json({
          message: "Duplicate request acknowledged. Returning existing job.",
          isDuplicate: true,
          job: {
            jobId: existingJob.jobId,
            type: existingJob.type,
            status: existingJob.status,
            createdAt: existingJob.createdAt,
          },
        });
      }
    }

    // 2.Attach key to req object so controller and service can bind it
    req.idempotencyKey = idempotencyKey;
    req.idempotencyRedisKey = redisKey;

    next();
  } catch (error) {
    console.error("[Idempotency Middleware Error", error.message);
    next(error);
  }
};


const saveIdempotency = async (redisKey, jobId, ttl = DEFAULT_TTL_SECONDS) => {
  await redisClient.set(redisKey, jobId, "EX", ttl);
};

module.exports = {
  idempotencyMiddleware,
  saveIdempotency,
  saveIdempotencyKey: saveIdempotency,
};