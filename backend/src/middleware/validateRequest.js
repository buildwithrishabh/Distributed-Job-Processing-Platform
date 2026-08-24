const { z } = require("zod");
const { JOB_TYPES } = require("../config/constant");

// Define Job Creation Schema using Zod
const createJobSchema = z.object({
  type: z.enum(Object.values(JOB_TYPES), {
    errorMap: () => ({
      message: `Invalid or missing job type. Allowed types: ${Object.values(JOB_TYPES).join(", ")}`,
    }),
  }),
  payload: z.record(z.any()).optional().default({}),
  priority: z.number().min(0, "Priority must be a non-negative number").optional().default(0),
  maxAttempts: z.number().int().min(1, "maxAttempts must be at least 1").optional().default(3),
});

// Express Request Validation Middleware
const validateCreateJob = (req, res, next) => {
  const result = createJobSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validation Error",
      details: result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }

  // Replace req.body with parsed & sanitized data
  req.body = result.data;
  next();
};

module.exports = {
  validateCreateJob,
  createJobSchema,
};
