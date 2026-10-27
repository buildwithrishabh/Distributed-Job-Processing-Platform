import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
  on: vi.fn(),
};

require.cache[require.resolve("../../../src/config/redis")] = {
  id: require.resolve("../../../src/config/redis"),
  filename: require.resolve("../../../src/config/redis"),
  loaded: true,
  exports: mockRedis,
};

delete require.cache[require.resolve("../../../src/utils/lock")];
const { acquireLock, releaseLock } = require("../../../src/utils/lock");

describe("Utils: Distributed Lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("acquireLock", () => {
    it("should return a 32-character hex lock token when lock acquisition succeeds", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const token = await acquireLock("job-123", 15);

      expect(mockRedis.set).toHaveBeenCalledWith(
        "lock:job-123",
        expect.any(String),
        "NX",
        "EX",
        15
      );
      expect(typeof token).toBe("string");
      expect(token).toHaveLength(32);
    });

    it("should return null when lock is already held by another process", async () => {
      mockRedis.set.mockResolvedValue(null);

      const token = await acquireLock("job-123", 10);

      expect(token).toBeNull();
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    it("should default TTL to 10 seconds if not provided", async () => {
      mockRedis.set.mockResolvedValue("OK");

      await acquireLock("job-456");

      expect(mockRedis.set).toHaveBeenCalledWith(
        "lock:job-456",
        expect.any(String),
        "NX",
        "EX",
        10
      );
    });
  });

  describe("releaseLock", () => {
    it("should return false immediately if lockToken is not provided", async () => {
      const result = await releaseLock("job-123", null);
      expect(result).toBe(false);
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it("should execute Lua script and return true when owner token matches", async () => {
      mockRedis.eval.mockResolvedValue(1);

      const result = await releaseLock("job-123", "owner-token-123");

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("if redis.call"),
        1,
        "lock:job-123",
        "owner-token-123"
      );
      expect(result).toBe(true);
    });

    it("should return false when lock token does not match (lock not owned or expired)", async () => {
      mockRedis.eval.mockResolvedValue(0);

      const result = await releaseLock("job-123", "wrong-token");

      expect(result).toBe(false);
    });
  });
});
