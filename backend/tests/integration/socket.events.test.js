import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { TEST_USER, createTestToken } = require("./helpers");

const mockUserModel = {
  findById: vi.fn(),
};

const mockJobModel = {
  findOne: vi.fn(),
};

require.cache[require.resolve("../../src/models/user")] = {
  id: require.resolve("../../src/models/user"),
  filename: require.resolve("../../src/models/user"),
  loaded: true,
  exports: mockUserModel,
};

require.cache[require.resolve("../../src/models/job")] = {
  id: require.resolve("../../src/models/job"),
  filename: require.resolve("../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

const socketAuthMiddleware = require("../../src/socket/auth.middleware");
const { registerJobHandlers } = require("../../src/socket/handlers/jobHandler");

describe("Integration: Socket.IO Real-Time Subscriptions and Events", () => {
  let httpServer;
  let ioServer;
  let serverPort;

  beforeAll(async () => {
    httpServer = http.createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: "*", credentials: true },
      transports: ["websocket", "polling"],
    });

    ioServer.use(socketAuthMiddleware);

    ioServer.on("connection", (socket) => {
      const userId = socket.user._id.toString();
      socket.join(`user:${userId}`);
      registerJobHandlers(ioServer, socket);
    });

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      ioServer.close(() => {
        httpServer.close(resolve);
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(TEST_USER),
    });
  });

  it("should fail connection when no cookies or credentials are provided", async () => {
    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", (err) => resolve(err));
    });

    expect(error).toBeDefined();
    expect(error.message).toContain("Authentication required");
    client.close();
  });

  it("should fail connection when invalid JWT access token cookie is provided", async () => {
    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        cookie: "accessToken=invalid.jwt.token",
      },
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", (err) => resolve(err));
    });

    expect(error).toBeDefined();
    expect(error.message).toContain("Unauthorized");
    client.close();
  });

  it("should successfully connect with valid accessToken cookie and join user room", async () => {
    const token = createTestToken(TEST_USER);

    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${token}`,
      },
    });

    const connected = await new Promise((resolve) => {
      client.on("connect", () => resolve(true));
      client.on("connect_error", () => resolve(false));
    });

    expect(connected).toBe(true);

    // Verify room delivery by emitting to user room
    const receivedEvent = new Promise((resolve) => {
      client.on("job:updated", (data) => resolve(data));
    });

    ioServer.to(`user:${TEST_USER._id}`).emit("job:updated", {
      jobId: "job-101",
      status: "PROCESSING",
    });

    const data = await receivedEvent;
    expect(data).toEqual({
      jobId: "job-101",
      status: "PROCESSING",
    });

    client.close();
  });

  it("should emit 'job:error' if subscribing to an invalid jobId format", async () => {
    const token = createTestToken(TEST_USER);
    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${token}`,
      },
    });

    await new Promise((resolve) => client.on("connect", resolve));

    const errorPromise = new Promise((resolve) => {
      client.on("job:error", (err) => resolve(err));
    });

    client.emit("job:subscribe", "not-a-valid-object-id");

    const err = await errorPromise;
    expect(err).toEqual({
      message: "Invalid job ID",
    });

    client.close();
  });

  it("should emit 'job:error' if job is not found or belongs to another user", async () => {
    const token = createTestToken(TEST_USER);
    const foreignJobId = "507f1f77bcf86cd799439099";

    mockJobModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${token}`,
      },
    });

    await new Promise((resolve) => client.on("connect", resolve));

    const errorPromise = new Promise((resolve) => {
      client.on("job:error", (err) => resolve(err));
    });

    client.emit("job:subscribe", foreignJobId);

    const err = await errorPromise;
    expect(err).toEqual({
      message: "Job not found or access denied",
    });

    client.close();
  });

  it("should allow subscribing to owned job and receive job-specific room events", async () => {
    const token = createTestToken(TEST_USER);
    const ownedJobId = "507f1f77bcf86cd799439022";

    mockJobModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: ownedJobId }),
    });

    const client = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${token}`,
      },
    });

    await new Promise((resolve) => client.on("connect", resolve));

    client.emit("job:subscribe", ownedJobId);

    // Wait a brief tick for server to process join
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Emit event to job room
    const progressPromise = new Promise((resolve) => {
      client.on("job:progress", (data) => resolve(data));
    });

    ioServer.to(`job:${ownedJobId}`).emit("job:progress", {
      jobId: ownedJobId,
      progress: 60,
    });

    const progressData = await progressPromise;
    expect(progressData).toEqual({
      jobId: ownedJobId,
      progress: 60,
    });

    // Test unsubscribe
    client.emit("job:unsubscribe", ownedJobId);
    await new Promise((resolve) => setTimeout(resolve, 50));

    client.close();
  });
});

