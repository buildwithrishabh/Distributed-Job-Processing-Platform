const https = require("http");
const connectDB = require("./config/db");
const { createJobWorker } = require("./worker/jobWorker");
const env = require("./config/env");
const { startWorkerHeartBeat } = require("./utils/heartBeat");
const logger = require("./utils/logger");

const startWorkerProcess = async () => {
  try {
    await connectDB();

    const os = require("os");
    const containerHost = os.hostname();
    const workerId = (process.env.WORKER_ID && process.env.WORKER_ID !== "worker_1")
      ? `${process.env.WORKER_ID}_${containerHost}`
      : `worker_${containerHost}`;
    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

    const stopHeartBeat = startWorkerHeartBeat(workerId);

    const worker = createJobWorker(workerId, concurrency);
    logger.info(
      { workerId, concurrency },
      `[Worker Process] Initialized with concurrency: ${concurrency}`
    );

    // Health server for render web service port detection 
    const port = process.env.PORT || 10000;
    const healthServer = https.createServer((req , res) => {
      res.writeHead(200 , {"content-type" : "application/json"})
      res.end(JSON.stringify({
        status : "ok",
        workerId,
        concurrency,
        uptime : process.uptime(),
        pid : process.pid
      }))
    })
    healthServer.listen(port , () => {
      logger.info({ port, workerId }, `[Health Server] Worker health check server started on port ${port}`); 
    })

    const shutdown = async (signal) => {
      logger.info(
        { signal, workerId },
        `[Worker Process] ${signal} received. Closing worker gracefully...`
      );

      await stopHeartBeat();
      await worker.close();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logger.fatal({ err: error }, "[Worker Process] Failed to start");
    process.exit(1);
  }
};

startWorkerProcess();