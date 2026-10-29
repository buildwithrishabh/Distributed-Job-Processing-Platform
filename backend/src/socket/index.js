const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const redisClient = require("../config/redis");
const socketAuthMiddleware = require("./auth.middleware");
const { registerJobHandlers } = require("./handlers/jobHandler");
const { startQueueEventListener } = require("./listeners/queueEvents");
const env = require("../config/env");
const logger = require("../utils/logger");

let io = null;

const initSocketIO = (httpServer) => {
  // 1. Create dedicated pub and sub duplicate clients for the redis adapter
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  pubClient.on("error", (err) =>
    logger.error({ err }, "[Socket.io Redis Pub] Error"),
  );
  subClient.on("error", (err) =>
    logger.error({ err }, "[Socket.io Redis Sub] Error"),
  );

  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
    transports: ["websocket", "polling"],
  });

  // 2. Attach Auth Middleware
  io.use(socketAuthMiddleware);

  // 3. Connection Lifecycle
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    const userRoom = `user:${userId}`;

    // Join private user room automatically
    socket.join(userRoom);
    logger.info(
      { socketId: socket.id, userId },
      `[Socket.io] Client connected & joined ${userRoom}`,
    );

    // Register job room handlers (join specific job rooms for progress tracking)
    registerJobHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      logger.info(
        { socketId: socket.id, userId, reason },
        "[Socket.io] Client disconnected",
      );
    });
  });

  // 4. Start BullMQ queue listener to bridge worker events to sockets
  startQueueEventListener(io);

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

const closeSocketIO = () => {
  return new Promise((resolve) => {
    if (!io) {
      return resolve();
    }
    io.close(() => {
      logger.info("[Socket.io] Server closed.");
      io = null;
      resolve();
    });
  });
};

module.exports = {
  initSocketIO,
  initiateSocketIO: initSocketIO,
  getIO,
  closeSocketIO,
};
