const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const slidingWindowRateLimiter = require("../middleware/rateLimiter");
const {
  getMe,
  register,
  login,
  refresh,
  logout,
} = require("../controllers/authController");

// Rate limiter for sensitive auth routes (brute-force protection)
const authLimiter = slidingWindowRateLimiter({
  prefix: "rate-limit:auth",
  message: "Too many authentication attempts. Please try again later.",
});

router.get("/me", authenticate, getMe);
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
