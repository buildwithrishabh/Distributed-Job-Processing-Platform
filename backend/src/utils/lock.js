const redisClient = require("../config/redis");
const crypto = require("crypto");


// Lua Script for atomic lock release (verifies ownership before deleting).
const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

const acquireLock = async (lockKey ,ttlseconds = 10) => {
    const lockToken = crypto.randomBytes(16).toString("hex");
    const fullKey = `lock:${lockKey}`;

    // set key value NX EX ttl 
    const result = await redisClient.set(fullKey , lockToken , "NX" ,"EX" , ttlseconds);

    if (result === "OK") {
        return lockToken;
    }

    return null;
}

// safely release a distributed lock using lua script 
const releaseLock = async (lockKey , lockToken) => {
    if (!lockToken) return false;

    const fullKey = `lock:${lockKey}`;

    const result = await redisClient.eval(RELEASE_LOCK_LUA_SCRIPT , 1 , fullKey , lockToken);

    return result === 1;
}


module.exports = {
    acquireLock,
    releaseLock,
}