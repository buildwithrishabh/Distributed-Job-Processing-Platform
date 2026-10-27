const redisClient = require("../config/redis");
const Job = require("../models/job");
const logger = require("../utils/logger");

const IDEMPOTENCY_PREFIX = "idempotency:";
const DEFAULT_TTL_SECONDS = 86400; // 24 Hours

const IDEMPOTENCY_LOCK_TTL = 30;

const idempotencyMiddleware = async (req, res, next) => {
  const log = req.log || logger;
  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey) {
    return next();
  }

  const userPrefix = req.user ? `${req.user._id}:` : "";
  const redisKey = `${IDEMPOTENCY_PREFIX}${userPrefix}${idempotencyKey}`;

  try {
    // 1. ATOMIC LOCK: Set Key to "IN_PROGRESS"  only if it does not exits(NX)
    const acquired = await redisClient.set(
      redisKey,
      "IN_PROGRESS",
      "EX",
      IDEMPOTENCY_LOCK_TTL,
      "NX",
    );

    // 2. Lock nahi mila (key already exists)
    if (!acquired) {
      const cachedValue = await redisClient.get(redisKey);

      // CASE A: Parallel request already in-progress
      if (cachedValue === "IN_PROGRESS") {
        return res.status(409).json({
          success: false,
          error:
            "A request with this Idempotency-Key is currently being processed. Please retry shortly.",
        });
      }

      // CASE B: Job already created (cachedValue is jobId)
      if (cachedValue) {
        log.info(
          { idempotencyKey, cachedJobId: cachedValue },
          `[Idempotency] Duplicate request detected for key: ${idempotencyKey}`
        );

        const existingJob = await Job.findOne({
          jobId: cachedValue,
          userId: req.user?._id,
        });

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
    }

    // 2.Attach key to req object so controller and service can bind it
    req.idempotencyKey = idempotencyKey;
    req.idempotencyRedisKey = redisKey;

    next();
  } catch (error) {
    log.error({ err: error, idempotencyKey }, `[Idempotency Middleware Error]: ${error.message}`);
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
