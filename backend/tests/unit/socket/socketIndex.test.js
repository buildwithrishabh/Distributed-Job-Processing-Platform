import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let connectionHandler = null;
let middlewareHandler = null;
const mockServerInstance = {
  use: vi.fn((mw) => {
    middlewareHandler = mw;
  }),
  on: vi.fn((event, handler) => {
    if (event === "connection") {
      connectionHandler = handler;
    }
  }),
  close: vi.fn((cb) => {
    if (cb) cb();
  }),
};

const MockServerClass = vi.fn(function () {
  return mockServerInstance;
});

const mockCreateAdapter = vi.fn((pub, sub) => ({ pub, sub }));

require.cache[require.resolve("socket.io")] = {
  id: require.resolve("socket.io"),
  filename: require.resolve("socket.io"),
  loaded: true,
  exports: { Server: MockServerClass },
};

require.cache[require.resolve("@socket.io/redis-adapter")] = {
  id: require.resolve("@socket.io/redis-adapter"),
  filename: require.resolve("@socket.io/redis-adapter"),
  loaded: true,
  exports: { createAdapter: mockCreateAdapter },
};

const mockPubSubClient = {
  on: vi.fn(),
};

const mockRedisClient = {
  duplicate: vi.fn(() => ({
    on: vi.fn(),
  })),
};

require.cache[require.resolve("../../../src/config/redis")] = {
  id: require.resolve("../../../src/config/redis"),
  filename: require.resolve("../../../src/config/redis"),
  loaded: true,
  exports: mockRedisClient,
};

const mockAuthMiddleware = vi.fn();
require.cache[require.resolve("../../../src/socket/auth.middleware")] = {
  id: require.resolve("../../../src/socket/auth.middleware"),
  filename: require.resolve("../../../src/socket/auth.middleware"),
  loaded: true,
  exports: mockAuthMiddleware,
};

const mockRegisterJobHandlers = vi.fn();
require.cache[require.resolve("../../../src/socket/handlers/jobHandler")] = {
  id: require.resolve("../../../src/socket/handlers/jobHandler"),
  filename: require.resolve("../../../src/socket/handlers/jobHandler"),
  loaded: true,
  exports: { registerJobHandlers: mockRegisterJobHandlers },
};

const mockStartQueueEventListener = vi.fn();
require.cache[require.resolve("../../../src/socket/listeners/queueEvents")] = {
  id: require.resolve("../../../src/socket/listeners/queueEvents"),
  filename: require.resolve("../../../src/socket/listeners/queueEvents"),
  loaded: true,
  exports: { startQueueEventListener: mockStartQueueEventListener },
};

delete require.cache[require.resolve("../../../src/socket/index")];
const {
  initSocketIO,
  getIO,
  closeSocketIO,
} = require("../../../src/socket/index");

describe("Socket Server Lifecycle: initSocketIO, getIO, closeSocketIO", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await closeSocketIO();
  });

  afterEach(async () => {
    await closeSocketIO();
  });

  it("should throw error if getIO() is called before initialization", () => {
    expect(() => getIO()).toThrow("Socket.io has not been initialized!");
  });

  it("should resolve immediately when closeSocketIO() is called with no active io instance", async () => {
    await expect(closeSocketIO()).resolves.toBeUndefined();
  });

  it("should initialize Socket.IO with redis adapter, middleware and queue event listener", () => {
    const mockHttpServer = {};
    const io = initSocketIO(mockHttpServer);

    expect(mockRedisClient.duplicate).toHaveBeenCalledTimes(2);
    expect(MockServerClass).toHaveBeenCalledWith(
      mockHttpServer,
      expect.objectContaining({
        transports: ["websocket", "polling"],
        adapter: expect.any(Object),
      }),
    );
    expect(mockServerInstance.use).toHaveBeenCalledWith(mockAuthMiddleware);
    expect(mockStartQueueEventListener).toHaveBeenCalledWith(mockServerInstance);
    expect(getIO()).toBe(mockServerInstance);
  });

  it("should handle client connection, join user room, and register job handlers", () => {
    const mockHttpServer = {};
    initSocketIO(mockHttpServer);

    const disconnectHandlers = {};
    const mockSocket = {
      id: "sock-123",
      user: { _id: "user-456" },
      join: vi.fn(),
      on: vi.fn((event, handler) => {
        disconnectHandlers[event] = handler;
      }),
    };

    expect(connectionHandler).toBeDefined();
    connectionHandler(mockSocket);

    expect(mockSocket.join).toHaveBeenCalledWith("user:user-456");
    expect(mockRegisterJobHandlers).toHaveBeenCalledWith(mockServerInstance, mockSocket);
    expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));

    // verify disconnect callback does not throw
    expect(() => disconnectHandlers["disconnect"]("transport close")).not.toThrow();
  });

  it("should close the server and reset io on closeSocketIO()", async () => {
    const mockHttpServer = {};
    initSocketIO(mockHttpServer);

    expect(getIO()).toBe(mockServerInstance);

    await closeSocketIO();

    expect(mockServerInstance.close).toHaveBeenCalledTimes(1);
    expect(() => getIO()).toThrow("Socket.io has not been initialized!");
  });
});

