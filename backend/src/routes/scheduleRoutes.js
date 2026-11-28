
const express = require("express");
const router = express.Router();

const scheduleController = require("../controllers/scheduleController");
const { authenticate } = require("../middleware/auth");
const {
  validateCreateSchedule,
  validateUpdateSchedule,
} = require("../middleware/validateRequest");
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

// Update Schedule
router.patch(
  "/:scheduleId",
  authenticate,
  validateUpdateSchedule,
  scheduleController.updateSchedule
);

// Pause Schedule
router.post(
  "/:scheduleId/pause",
  authenticate,
  scheduleController.pauseSchedule
);

// Resume Schedule
router.post(
  "/:scheduleId/resume",
  authenticate,
  scheduleController.resumeSchedule
);

// Cancel Schedule
router.post(
  "/:scheduleId/cancel",
  authenticate,
  scheduleController.cancelSchedule
);

// Delete Schedule
router.delete(
  "/:scheduleId",
  authenticate,
  scheduleController.deleteSchedule
);

module.exports = router;
