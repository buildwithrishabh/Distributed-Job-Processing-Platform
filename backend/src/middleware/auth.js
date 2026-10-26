const jwt = require("jsonwebtoken");
const { ACCESS_TOKEN_SECRET, JWT_SECRET } = require("../config/env");
const User = require("../models/user");

const authenticate = async (req, res, next) => {
  try {
    let token;

    // Extract access token: prioritize Authorization Header, fallback to HTTP-only Cookie
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
      token = req.cookies.accessToken || req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed. Access token missing.",
      });
    }

    const secret = process.env.JWT_ACCESS_SECRET || ACCESS_TOKEN_SECRET || JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select("-password -refreshToken");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User account no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        error: "Access token expired. Please refresh your token.",
      });
    }
    return res.status(401).json({
      success: false,
      error: "Invalid access token.",
    });
  }
};

module.exports = { authenticate };
