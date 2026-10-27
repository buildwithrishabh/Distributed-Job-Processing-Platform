import jwt from "jsonwebtoken";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const env = require("../../src/config/env");

export const TEST_USER = {
  _id: "507f1f77bcf86cd799439011",
  email: "test.integration@example.com",
  name: "Integration Test User",
  role: "user",
};

export const createTestToken = (user = TEST_USER) => {
  const secret =
    process.env.JWT_ACCESS_SECRET || env.ACCESS_TOKEN_SECRET || env.JWT_SECRET;
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    secret,
    { expiresIn: "1h" }
  );
};

export const createTestRefreshToken = (user = TEST_USER) => {
  const secret =
    process.env.JWT_REFRESH_SECRET ||
    env.REFRESH_TOKEN_SECRET ||
    env.JWT_SECRET;
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: "7d" }
  );
};
