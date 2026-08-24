const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");
const { authenticate } = require("../middleware/auth");
const { validateCreateJob } = require("../middleware/validateRequest");

// Protect job endpoints with authentication middleware
router.post("/jobs", authenticate, validateCreateJob, jobController.createJob);
router.get("/jobs", authenticate, jobController.getJobs);
router.get("/jobs/:id", authenticate, jobController.getJobById);
router.delete("/jobs/:id", authenticate, jobController.deleteJob);

module.exports = router;
