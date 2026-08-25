const express = require("express");
const router = express.Router();
const dlqController = require("../controllers/dlqController");

router.get("/jobs/dead", dlqController.getDeadJobs);
router.post("/jobs/:id/retry", dlqController.retryDeadJob);

module.exports = router;