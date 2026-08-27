const redisClient = require("../config/redis");

const HEARTBEAT_PREFIX = "worker:heartbeat:";
const INTERVAL_MS = 10000; // Send heartbeat every 10 seconds
const TTL_SECONDS = 30; // Heartbeat expires after 30 seconds

// Start worker heartbeat timer loop
const startWorkerHeartBeat = (workerId) => {
  const redisKey = `${HEARTBEAT_PREFIX}${workerId}`;

  async function sendHeartBeat() {
    try {
      const payload = JSON.stringify({
        workerId,
        pid: process.pid,
        status: "ONLINE",
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        lastSeen: new Date().toISOString(),
        lastSeenTimestamp: Date.now(),
      });

      //   write to redis with ex 30 seconds
      await redisClient.set(redisKey, payload, "EX", TTL_SECONDS);
    } catch (error) {
      console.error(
        `[Heartbeat] Failed to send heartbeat for ${workerId}:`,
        error.message,
      );
    }
  }

  //   send intial heartbeat immediately
  sendHeartBeat();

  //   Register interval loop
  const intervalId = setInterval(sendHeartBeat , INTERVAL_MS);

  return async function stopHeartBeat() {
    clearInterval(intervalId);
    try {
      await redisClient.del(redisKey);
    } catch (err) {
      // Ignore teardown error
    }
  }

};


const getActiveWorker = async () => {
    const keys = await redisClient.keys(`${HEARTBEAT_PREFIX}*`);
    if (!keys.length) return [];

    const rawData = await redisClient.mget(keys);
    const now = Date.now();

    return rawData.filter(Boolean).map(((item) => {
        const worker = JSON.parse(item);
        const timeDiff = now - worker.lastSeenTimestamp;

        // Evaluate Status.
        let health = "HEALTHY";
        if (timeDiff > 15000) health = "STALE";
        if (timeDiff > 30000) health = "DEAD";

        return {
            ...worker ,
            health ,
            secondsSinceLastSeen: Math.floor(timeDiff / 1000),
        }
    }))
}

module.exports = {
    startWorkerHeartBeat ,
    getActiveWorker ,
}
