const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getMe,
  register,
  login,
  refresh,
  logout,
} = require("../controllers/authController");

router.get("/me", authenticate, getMe);
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
