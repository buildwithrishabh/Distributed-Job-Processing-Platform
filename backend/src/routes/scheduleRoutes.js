
const express = require("express");
const router = express.Router();

const scheduleController = require("../controllers/scheduleController");
const { authenticate } = require("../middleware/auth");
const { validateCreateSchedule } = require("../middleware/validateRequest");
const slidingWindowRateLimiter = require("../middleware/rateLimiter");

const scheduleRateLimiter = slidingWindowRateLimiter({
  prefix: "rate-limit:schedules",
  message: "Schedule creation limit reached. Please wait.",
});

// Create Schedule
router.post(
  "/",
  authenticate,
  scheduleRateLimiter,
  validateCreateSchedule,
  scheduleController.createSchedule
);

// Get All Schedules
router.get(
  "/",
  authenticate,
  scheduleController.getSchedules
);

// Get Schedule By ID
router.get(
  "/:scheduleId",
  authenticate,
  scheduleController.getScheduleById
);

// Get Schedule Execution History
router.get(
  "/:scheduleId/executions",
  authenticate,
  scheduleController.getScheduleExecutions
);

module.exports = router;
