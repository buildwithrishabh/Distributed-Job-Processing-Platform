const dns = require("dns");
dns.setServers(["8.8.8.8" ,"1.1.1.1"]);
const https = require("http");
const connectDB = require("./config/db");
const { createJobWorker } = require("./worker/jobWorker");
const env = require("./config/env");
const { startWorkerHeartBeat } = require("./utils/heartBeat");

const startWorkerProcess = async () => {
  try {
    await connectDB();

    const workerId = process.env.WORKER_ID || `worker_${process.pid}`;
    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

    
    const stopHeartBeat = startWorkerHeartBeat(workerId);

    const worker = createJobWorker(workerId, concurrency);
    console.log(
      `[Worker Process] ${workerId} initialized with concurrency: ${concurrency}`,
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
      console.log(`[Health Server] Worker health check server started on port ${port}`) ; 
    })

    const shutdown = async (signal) => {
      console.log(
        `[Worker Process] ${signal} received. Closing worker gracefully...`,
      );

      await stopHeartBeat();
      await worker.close();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("[Worker Process] Failed to start:", error);
    process.exit(1);
  }
};

startWorkerProcess();