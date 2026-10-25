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
  const intervalId = setInterval(sendHeartBeat, INTERVAL_MS);

  return async function stopHeartBeat() {
    clearInterval(intervalId);
    try {
      await redisClient.del(redisKey);
    } catch (err) {
      // Ignore teardown error
    }
  };
};

const getActiveWorker = async () => {
  let cursor = "0";
  const keys = [];

  // 1. Scan Redis Keys non-blockingly
  do {
    const [nextCursor, matchedKeys] = await redisClient.scan(
      cursor,
      "MATCH",
      `${HEARTBEAT_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (matchedKeys.length) {
      keys.push(...matchedKeys);
    }
  } while (cursor !== "0");

  // 2. Agar koi worker nahi mila, early exit
  if (!keys.length) return [];

  // 3. Sabhi keys ka data ek sath fetch karna hai
  const rawData = await redisClient.mget(keys);
  const now = Date.now();

  return rawData.filter(Boolean).map((item) => {
    const worker = JSON.parse(item);
    const timeDiff = now - worker.lastSeenTimestamp;

    // Evaluate Status
    let health = "HEALTHY";
    if (timeDiff > 15000) health = "STALE";
    if (timeDiff > 30000) health = "DEAD";

    return {
      ...worker,
      health,
      secondsSinceLastSeen: Math.floor(timeDiff / 1000),
    };
  });
};

module.exports = {
  startWorkerHeartBeat,
  getActiveWorker,
};
