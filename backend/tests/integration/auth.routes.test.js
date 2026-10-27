import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockUserModel = {
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
};

const mockRedis = {
  multi: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1], // count = 1
      [null, 1],
    ]),
  })),
  on: vi.fn(),
};

require.cache[require.resolve("../../src/models/user")] = {
  id: require.resolve("../../src/models/user"),
  filename: require.resolve("../../src/models/user"),
  loaded: true,
  exports: mockUserModel,
};

require.cache[require.resolve("../../src/config/redis")] = {
  id: require.resolve("../../src/config/redis"),
  filename: require.resolve("../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

const app = require("../../src/app");
const { hashToken } = require("../../src/utils/jwt");
const {
  TEST_USER,
  createTestToken,
  createTestRefreshToken,
} = require("./helpers");

describe("Integration: Auth Routes (/api/auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should successfully register a new user and return 201 with sanitized profile", async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        _id: "user-new-123",
        name: "New User",
        email: "newuser@example.com",
      });

      const res = await request(app).post("/api/auth/register").send({
        name: "New User",
        email: "newuser@example.com",
        password: "securepassword123",
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("User registered successfully");
      expect(res.body.user).toEqual({
        id: "user-new-123",
        name: "New User",
        email: "newuser@example.com",
      });
      expect(res.body.user.password).toBeUndefined();
    });

    it("should return 400 when required fields are missing", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "incomplete@example.com",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Please fill all fields");
    });

    it("should return 400 when email already exists", async () => {
      mockUserModel.findOne.mockResolvedValue({
        _id: "existing-user-id",
        email: "existing@example.com",
      });

      const res = await request(app).post("/api/auth/register").send({
        name: "Existing",
        email: "existing@example.com",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("User already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully, set cookies, and return accessToken with 200", async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("password123", salt);

      const dbUser = {
        _id: "user-login-123",
        name: "Login User",
        email: "login@example.com",
        password: hashedPassword,
        save: vi.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(dbUser),
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe("login@example.com");

      // Verify cookies are set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes("accessToken="))).toBe(true);
      expect(cookies.some((c) => c.includes("refreshToken="))).toBe(true);
    });

    it("should return 400 for non-existent user email", async () => {
      mockUserModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    it("should return 400 for incorrect password", async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("correct-password", salt);

      const dbUser = {
        _id: "user-123",
        email: "test@example.com",
        password: hashedPassword,
      };

      mockUserModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(dbUser),
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrong-password",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user profile when authenticated with Bearer token", async () => {
      const token = createTestToken();

      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(TEST_USER),
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Access token missing");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should rotate tokens and return 200 when valid refresh cookie provided", async () => {
      const rawRefreshToken = createTestRefreshToken(TEST_USER);
      const hashed = hashToken(rawRefreshToken);

      const dbUser = {
        _id: TEST_USER._id,
        name: TEST_USER.name,
        email: TEST_USER.email,
        refreshToken: hashed,
        save: vi.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(dbUser),
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${rawRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Refresh token successful");
      expect(res.body.accessToken).toBeDefined();
      expect(dbUser.save).toHaveBeenCalledTimes(1);
    });

    it("should return 401 if refresh token cookie is missing", async () => {
      const res = await request(app).post("/api/auth/refresh");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Refresh token missing");
    });

    it("should return 403 if refresh token does not match stored hash (token mismatch/revoked)", async () => {
      const rawRefreshToken = createTestRefreshToken(TEST_USER);

      const dbUser = {
        _id: TEST_USER._id,
        refreshToken: "different_hashed_token",
      };

      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(dbUser),
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${rawRefreshToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Refresh token mismatch");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear auth cookies and nullify refresh token in DB", async () => {
      const rawRefreshToken = createTestRefreshToken(TEST_USER);
      const dbUser = {
        _id: TEST_USER._id,
        refreshToken: hashToken(rawRefreshToken),
        save: vi.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockResolvedValue(dbUser);

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`refreshToken=${rawRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Logged out successfully");
      expect(dbUser.refreshToken).toBeNull();
      expect(dbUser.save).toHaveBeenCalledTimes(1);
    });
  });
});
