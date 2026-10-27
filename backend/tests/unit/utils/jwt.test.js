import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../../../src/utils/jwt.js";
import env from "../../../src/config/env.js";

describe("Utils: JWT", () => {
  const mockUser = {
    _id: "65f1a2b3c4d5e6f7a8b9c0d1",
    email: "test@example.com",
    name: "Test User",
    role: "user",
  };

  const accessSecret =
    process.env.JWT_ACCESS_SECRET || env.ACCESS_TOKEN_SECRET || env.JWT_SECRET;
  const refreshSecret =
    process.env.JWT_REFRESH_SECRET ||
    env.REFRESH_TOKEN_SECRET ||
    env.JWT_SECRET;

  describe("generateAccessToken", () => {
    it("should generate a valid JWT access token with user payload", () => {
      const token = generateAccessToken(mockUser);
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, accessSecret);
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.name).toBe(mockUser.name);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid JWT refresh token with user payload", () => {
      const token = generateRefreshToken(mockUser);
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, refreshSecret);
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.name).toBe(mockUser.name);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe("hashToken", () => {
    it("should return a consistent sha256 hex digest for a token", () => {
      const sampleToken = "sample-token-string-12345";
      const expectedHash = crypto
        .createHash("sha256")
        .update(sampleToken)
        .digest("hex");

      const hash = hashToken(sampleToken);
      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64);
    });

    it("should generate different hashes for different tokens", () => {
      const hash1 = hashToken("token-a");
      const hash2 = hashToken("token-b");
      expect(hash1).not.toBe(hash2);
    });
  });
});
