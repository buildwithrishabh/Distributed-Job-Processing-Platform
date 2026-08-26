const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");

const startServer = async () => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(
      `[HTTP Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`,
    );

    // 3. Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`[HTTP Server] ${signal} received. Shutting down...`);

      server.close(() => {
        console.log("[HTTP Server] Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  });
};

startServer();
