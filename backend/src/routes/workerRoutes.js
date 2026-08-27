const express = require("express");
const router = express.Router();
const workerController = require("../controllers/workerController");
const { authenticate } = require("../middleware/auth"); // optional

// GET /api/workers
router.get("/workers", authenticate, workerController.getWorkersStatus);

module.exports = router;
