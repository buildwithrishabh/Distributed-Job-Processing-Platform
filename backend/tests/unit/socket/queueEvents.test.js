import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let registeredListeners = {};
const mockQueueEventsInstance = {
  on: vi.fn((event, handler) => {
    registeredListeners[event] = handler;
  }),
  close: vi.fn().mockResolvedValue(),
};

const MockQueueEventsClass = vi.fn(function () {
  return mockQueueEventsInstance;
});

require.cache[require.resolve("bullmq")] = {
  id: require.resolve("bullmq"),
  filename: require.resolve("bullmq"),
  loaded: true,
  exports: {
    QueueEvents: MockQueueEventsClass,
    Queue: vi.fn(),
  },
};

require.cache[require.resolve("../../../src/queues/job.queue")] = {
  id: require.resolve("../../../src/queues/job.queue"),
  filename: require.resolve("../../../src/queues/job.queue"),
  loaded: true,
  exports: {
    QUEUE_NAME: "job-queue",
  },
};

const mockJobModel = {
  findOne: vi.fn(),
};

require.cache[require.resolve("../../../src/models/job")] = {
  id: require.resolve("../../../src/models/job"),
  filename: require.resolve("../../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

delete require.cache[require.resolve("../../../src/socket/listeners/queueEvents")];
const { startQueueEventListener } = require("../../../src/socket/listeners/queueEvents");

describe("Socket Listeners: startQueueEventListener", () => {
  let io;
  let roomEmitters;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredListeners = {};
    mockQueueEventsInstance.on.mockImplementation((event, handler) => {
      registeredListeners[event] = handler;
    });

    roomEmitters = {};
    io = {
      to: vi.fn((room) => {
        if (!roomEmitters[room]) {
          roomEmitters[room] = {
            emit: vi.fn(),
          };
        }
        return roomEmitters[room];
      }),
    };
  });

  it("should initialize QueueEvents and register all event handlers", () => {
    const cleanup = startQueueEventListener(io);

    expect(MockQueueEventsClass).toHaveBeenCalled();
    expect(mockQueueEventsInstance.on).toHaveBeenCalledWith("active", expect.any(Function));
    expect(mockQueueEventsInstance.on).toHaveBeenCalledWith("progress", expect.any(Function));
    expect(mockQueueEventsInstance.on).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockQueueEventsInstance.on).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(typeof cleanup).toBe("function");
  });

  describe("active event", () => {
    it("should emit job:updated to user and job:state to job room when job has userId", async () => {
      startQueueEventListener(io);

      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          userId: "user-123",
          type: "email",
          status: "PROCESSING",
        }),
      });

      await registeredListeners["active"]({ jobId: "job-abc" });

      expect(mockJobModel.findOne).toHaveBeenCalledWith({ jobId: "job-abc" });
      expect(io.to).toHaveBeenCalledWith("user:user-123");
      expect(roomEmitters["user:user-123"].emit).toHaveBeenCalledWith("job:updated", {
        jobId: "job-abc",
        status: "PROCESSING",
      });
      expect(io.to).toHaveBeenCalledWith("job:job-abc");
      expect(roomEmitters["job:job-abc"].emit).toHaveBeenCalledWith("job:state", {
        jobId: "job-abc",
        status: "PROCESSING",
      });
    });

    it("should catch database lookup error gracefully without throwing", async () => {
      startQueueEventListener(io);

      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error("Mongo connection drop")),
      });

      await expect(registeredListeners["active"]({ jobId: "job-abc" })).resolves.not.toThrow();
    });
  });

  describe("progress event", () => {
    it("should emit job:progress with percentage data to the job room", () => {
      startQueueEventListener(io);

      registeredListeners["progress"]({ jobId: "job-xyz", data: 75 });

      expect(io.to).toHaveBeenCalledWith("job:job-xyz");
      expect(roomEmitters["job:job-xyz"].emit).toHaveBeenCalledWith("job:progress", {
        jobId: "job-xyz",
        progress: 75,
      });
    });
  });

  describe("completed event", () => {
    it("should emit job:updated and job:completed with returnvalue", async () => {
      startQueueEventListener(io);

      const completedTime = new Date().toISOString();
      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          userId: "user-456",
          completedAt: completedTime,
          status: "COMPLETED",
        }),
      });

      await registeredListeners["completed"]({
        jobId: "job-789",
        returnvalue: { messageId: "msg-123", status: "sent" },
      });

      expect(roomEmitters["user:user-456"].emit).toHaveBeenCalledWith("job:updated", {
        jobId: "job-789",
        status: "COMPLETED",
        completedAt: completedTime,
      });
      expect(roomEmitters["job:job-789"].emit).toHaveBeenCalledWith("job:completed", {
        jobId: "job-789",
        status: "COMPLETED",
        result: { messageId: "msg-123", status: "sent" },
      });
    });

    it("should handle error in completed event gracefully", async () => {
      startQueueEventListener(io);

      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      await expect(
        registeredListeners["completed"]({ jobId: "job-err", returnvalue: null }),
      ).resolves.not.toThrow();
    });
  });

  describe("failed event", () => {
    it("should return early and not emit if job is not found in database", async () => {
      startQueueEventListener(io);

      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await registeredListeners["failed"]({
        jobId: "job-unknown",
        failedReason: "Timeout",
      });

      expect(io.to).not.toHaveBeenCalled();
    });

    it("should emit job:updated and job:failed if job is found", async () => {
      startQueueEventListener(io);

      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          userId: "user-789",
          status: "FAILED",
          attempts: 3,
          maxAttempts: 3,
        }),
      });

      await registeredListeners["failed"]({
        jobId: "job-fail",
        failedReason: "Connection refused",
      });

      expect(roomEmitters["user:user-789"].emit).toHaveBeenCalledWith("job:updated", {
        jobId: "job-fail",
        status: "FAILED",
        attempts: 3,
        error: "Connection refused",
      });
      expect(roomEmitters["job:job-fail"].emit).toHaveBeenCalledWith("job:failed", {
        jobId: "job-fail",
        status: "FAILED",
        reason: "Connection refused",
      });
    });
  });

  describe("cleanup", () => {
    it("should close queueEvents when calling the returned cleanup function", async () => {
      const cleanup = startQueueEventListener(io);

      await cleanup();

      expect(mockQueueEventsInstance.close).toHaveBeenCalledTimes(1);
    });
  });
});
