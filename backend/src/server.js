const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const redisClient = require("./config/redis");
const { startOrphanJobSweeper } = require("./cron/orphanJobSweeper");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();

  // 1. Store app.listen instance in `server` variable
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `[HTTP Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`
    );
  });

  // Start Orphan Job Sweeper (recovers stuck PENDING jobs)
  const stopSweeper = startOrphanJobSweeper();
  logger.info("[Sweeper] Orphan job sweeper started.");

  // 2. Graceful Shutdown Handler
  const shutdown = async (signal) => {
    logger.info({ signal }, `[HTTP Server] ${signal} received. Closing HTTP server...`);

    if (stopSweeper) {
      stopSweeper();
      logger.info("[Sweeper] Orphan job sweeper stopped.");
    }

    server.close(async () => {
      logger.info("[HTTP Server] HTTP server closed.");

      try {
        await mongoose.connection.close();
        logger.info("[MongoDB] Database connection closed.");

        await redisClient.quit();
        logger.info("[Redis] Redis connection closed.");

        process.exit(0);
      } catch (err) {
        logger.error({ err }, "[Shutdown Error] Failed during graceful shutdown");
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();
