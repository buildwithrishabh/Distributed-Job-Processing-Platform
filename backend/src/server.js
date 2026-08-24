const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");

const startServer = async () => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`[HTTP Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });
};

startServer();
