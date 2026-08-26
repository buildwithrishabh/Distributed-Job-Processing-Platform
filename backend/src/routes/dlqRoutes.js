const express = require("express");
const router = express.Router();
const dlqController = require("../controllers/dlqController");
const {authenticate} = require("../middleware/auth");

router.get("/jobs/dead",authenticate, dlqController.getDeadJobs);
router.post("/jobs/:id/retry",authenticate ,  dlqController.retryDeadJob);

module.exports = router;