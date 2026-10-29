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

delete require.cache[require.resolve("../../../src/socket/auth.middleware")];
const socketAuthMiddleware = require("../../../src/socket/auth.middleware");
const env = require("../../../src/config/env");

describe("Socket Middleware: socketAuthMiddleware", () => {
  const secret = env.ACCESS_TOKEN_SECRET;

  const mockUser = {
    _id: "65f1a2b3c4d5e6f7a8b9c0d1",
    email: "socket.user@example.com",
    name: "Socket User",
  };

  const createMockSocket = (cookieHeader) => {
    return {
      handshake: {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail with 'Authentication required' if cookie header is missing", async () => {
    const socket = createMockSocket(null);
    const next = vi.fn();

    await socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Authentication required");
    expect(socket.user).toBeUndefined();
  });

  it("should fail with 'Access token missing' if cookie header has no accessToken", async () => {
    const socket = createMockSocket("theme=dark; session=abc123xyz");
    const next = vi.fn();

    await socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Access token missing");
  });

  it("should fail with 'Unauthorized' if accessToken is invalid or corrupt", async () => {
    const socket = createMockSocket("accessToken=invalid.jwt.token");
    const next = vi.fn();

    await socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Unauthorized");
  });

  it("should fail with 'User not found' if user does not exist in DB", async () => {
    const validToken = jwt.sign({ id: mockUser._id }, secret, { expiresIn: "15m" });
    const socket = createMockSocket(`accessToken=${validToken}`);
    const next = vi.fn();

    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    await socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("User not found");
  });

  it("should attach socket.user and call next() without error on valid token", async () => {
    const validToken = jwt.sign({ id: mockUser._id }, secret, { expiresIn: "15m" });
    const socket = createMockSocket(`other=test; accessToken=${validToken}; foo=bar`);
    const next = vi.fn();

    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    await socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error passed
    expect(socket.user).toEqual(mockUser);
  });
});

