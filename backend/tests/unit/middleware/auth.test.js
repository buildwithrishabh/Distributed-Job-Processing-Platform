import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockUserModel = {
  findById: vi.fn(),
};

require.cache[require.resolve("../../../src/models/user")] = {
  id: require.resolve("../../../src/models/user"),
  filename: require.resolve("../../../src/models/user"),
  loaded: true,
  exports: mockUserModel,
};

delete require.cache[require.resolve("../../../src/middleware/auth")];
const { authenticate } = require("../../../src/middleware/auth");
const env = require("../../../src/config/env");

describe("Middleware: authenticate", () => {
  const secret =
    process.env.JWT_ACCESS_SECRET || env.ACCESS_TOKEN_SECRET || env.JWT_SECRET;

  const mockUser = {
    _id: "65f1a2b3c4d5e6f7a8b9c0d1",
    email: "auth@example.com",
    name: "Auth User",
    role: "user",
  };

  const createReqRes = (headers = {}, cookies = {}) => {
    const req = {
      headers,
      cookies,
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject with 401 if access token is missing", async () => {
    const { req, res, next } = createReqRes();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Access token missing"),
      })
    );
  });

  it("should authenticate successfully using Bearer token in Authorization header", async () => {
    const token = jwt.sign({ id: mockUser._id }, secret, { expiresIn: "1h" });
    const { req, res, next } = createReqRes({
      authorization: `Bearer ${token}`,
    });

    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    await authenticate(req, res, next);

    expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser._id);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should fallback to cookie if Authorization header is not present", async () => {
    const token = jwt.sign({ id: mockUser._id }, secret, { expiresIn: "1h" });
    const { req, res, next } = createReqRes({}, { accessToken: token });

    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    await authenticate(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should return 401 with TOKEN_EXPIRED code when access token has expired", async () => {
    const expiredToken = jwt.sign({ id: mockUser._id }, secret, {
      expiresIn: "-1s",
    });
    const { req, res, next } = createReqRes({
      authorization: `Bearer ${expiredToken}`,
    });

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "TOKEN_EXPIRED",
        error: expect.stringContaining("Access token expired"),
      })
    );
  });

  it("should return 401 for an invalid or tampered token", async () => {
    const { req, res, next } = createReqRes({
      authorization: "Bearer invalid.token.payload",
    });

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid access token.",
      })
    );
  });

  it("should return 401 if user from decoded token no longer exists in DB", async () => {
    const token = jwt.sign({ id: "deleted-user-id" }, secret, {
      expiresIn: "1h",
    });
    const { req, res, next } = createReqRes({
      authorization: `Bearer ${token}`,
    });

    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "User account no longer exists.",
      })
    );
  });
});
