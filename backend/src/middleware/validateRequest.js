const { z } = require("zod");
const { JOB_TYPES, SCHEDULE_TYPES } = require("../config/constant");
const { isValidTimeZone, computeNextRunAt } = require("../utils/cronHelper");

// Define Job Creation Schema using Zod
const createJobSchema = z.object({
  type: z.enum(Object.values(JOB_TYPES), {
    errorMap: () => ({
      message: `Invalid or missing job type. Allowed types: ${Object.values(JOB_TYPES).join(", ")}`,
    }),
  }),
  payload: z.record(z.any()).optional().default({}),
  priority: z
    .number()
    .min(0, "Priority must be a non-negative number")
    .optional()
    .default(0),
  maxAttempts: z
    .number()
    .int()
    .min(1, "maxAttempts must be at least 1")
    .optional()
    .default(3),
});

// Shared Zod validation middleware factory
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    return res.status(400).json({
      error: "Validation Error",
      details: issues.map((err) => ({
        field: Array.isArray(err.path) ? err.path.join(".") : "",
        message: err.message,
      })),
    });
  }

  // Replace req.body with parsed & sanitized data
  req.body = result.data;
  next();
};

// Scheduling job schema
const createScheduleSchema = z
  .object({
    name: z.string().min(1, "Schedule name is required").trim(),
    jobType: z.enum(Object.values(JOB_TYPES)),
    payload: z.record(z.any()).optional().default({}),
    scheduleType: z.enum(Object.values(SCHEDULE_TYPES)),
    runAt: z.string().datetime().optional(), // ISO string
    priority: z.number().min(0).optional().default(0),
    maxAttempts: z.number().int().min(1).optional().default(3),
    cronExpression: z.string().trim().optional(),
    timezone: z.string().trim().optional().default("UTC"),
  })
  .refine(
    (data) => {
      if (data.scheduleType === SCHEDULE_TYPES.ONCE) {
        return (
          Boolean(data.runAt) && new Date(data.runAt).getTime() > Date.now()
        );
      }
      return true;
    },
    {
      message: "For ONCE schedules, runAt must be a valid future ISO timestamp",
      path: ["runAt"],
    },
  )
  .refine(
    (data) => isValidTimeZone(data.timezone),
    {
      message: "Invalid IANA timezone",
      path: ["timezone"],
    },
  )
  .refine(
    (data) => {
      if (data.scheduleType === SCHEDULE_TYPES.RECURRING) {
        if (!data.cronExpression) return false;
        try {
          return Boolean(
            computeNextRunAt(data.cronExpression, data.timezone, new Date()),
          );
        } catch {
          return false;
        }
      }
      return true;
    },
    {
      message: "For RECURRING schedules, a valid cronExpression is required",
      path: ["cronExpression"],
    },
  );

const validateCreateJob = validate(createJobSchema);
const validateCreateSchedule = validate(createScheduleSchema);

module.exports = {
  validateCreateJob,
  validateCreateSchedule,
  createJobSchema,
  createScheduleSchema,
};
