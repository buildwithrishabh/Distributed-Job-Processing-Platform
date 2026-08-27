const express = require("express");
const router = express.Router();
const monitoringController = require("../controllers/monitoringController");
const { authenticate } = require("../middleware/auth");

// Protect all monitoring routes below with authentication
router.use(authenticate);

router.get("/monitoring/queue", monitoringController.getQueueMetrics);
router.get("/monitoring/jobs", monitoringController.getJobStats);
router.get("/monitoring/workers", monitoringController.getWorkerMetrics);
router.get("/monitoring/overview", monitoringController.getOverviewMetrics);

module.exports = router;
