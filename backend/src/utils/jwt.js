const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const env = require("../config/env");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || env.ACCESS_TOKEN_SECRET || env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
const ACCESS_EXPIRES = env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = env.REFRESH_TOKEN_EXPIRES_IN || "7d";

// Generate Access Token
exports.generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES },
  );
};

// Generate Refresh Token
exports.generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES },
  );
};

exports.hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};