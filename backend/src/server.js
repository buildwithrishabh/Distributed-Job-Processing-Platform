const dns = require("dns")
dns.setServers(["8.8.8.8" ,"1.1.1.1"]);
const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const redisClient = require("./config/redis");

const startServer = async () => {
  await connectDB();

  // 1. Store app.listen instance in `server` variable
  const server = app.listen(env.PORT, () => {
    console.log(
      `[HTTP Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`
    );
  });

  // 2. Graceful Shutdown Handler
  const shutdown = async (signal) => {
    console.log(`[HTTP Server] ${signal} received. Closing HTTP server...`);

    server.close(async () => {
      console.log("[HTTP Server] HTTP server closed.");

      try {
        await mongoose.connection.close();
        console.log("[MongoDB] Database connection closed.");

        await redisClient.quit();
        console.log("[Redis] Redis connection closed.");

        process.exit(0);
      } catch (err) {
        console.error("[Shutdown Error]:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();
