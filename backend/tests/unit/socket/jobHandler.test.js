import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mockJobModel = {
  findOne: vi.fn(),
};

require.cache[require.resolve("../../../src/models/job")] = {
  id: require.resolve("../../../src/models/job"),
  filename: require.resolve("../../../src/models/job"),
  loaded: true,
  exports: mockJobModel,
};

delete require.cache[require.resolve("../../../src/socket/handlers/jobHandler")];
const { registerJobHandlers } = require("../../../src/socket/handlers/jobHandler");

describe("Socket Handlers: registerJobHandlers", () => {
  const mockUser = { _id: "65f1a2b3c4d5e6f7a8b9c0d1" };
  const validJobId = "65f1a2b3c4d5e6f7a8b9c0d2";

  let io;
  let socket;
  let eventHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = {};

    io = {};
    socket = {
      user: mockUser,
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
    };

    registerJobHandlers(io, socket);
  });

  describe("job:subscribe", () => {
    it("should register the 'job:subscribe' and 'job:unsubscribe' listeners", () => {
      expect(socket.on).toHaveBeenCalledWith("job:subscribe", expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith("job:unsubscribe", expect.any(Function));
    });

    it("should emit 'Invalid job ID' when jobId is not a valid ObjectId hex string", async () => {
      await eventHandlers["job:subscribe"]("invalid-id-format");

      expect(socket.emit).toHaveBeenCalledWith("job:error", {
        message: "Invalid job ID",
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it("should emit 'Invalid job ID' when jobId is not a string", async () => {
      await eventHandlers["job:subscribe"](12345);

      expect(socket.emit).toHaveBeenCalledWith("job:error", {
        message: "Invalid job ID",
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it("should emit 'Job not found or access denied' when job doesn't belong to the user", async () => {
      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await eventHandlers["job:subscribe"](validJobId);

      expect(mockJobModel.findOne).toHaveBeenCalledWith({
        _id: validJobId,
        userId: mockUser._id,
      });
      expect(socket.emit).toHaveBeenCalledWith("job:error", {
        message: "Job not found or access denied",
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it("should join room 'job:<jobId>' when user owns the job", async () => {
      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: validJobId }),
      });

      await eventHandlers["job:subscribe"](validJobId);

      expect(socket.join).toHaveBeenCalledWith(`job:${validJobId}`);
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it("should catch database errors and emit 'Unable to subscribe to job'", async () => {
      mockJobModel.findOne.mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error("DB Connection Error")),
      });

      await eventHandlers["job:subscribe"](validJobId);

      expect(socket.emit).toHaveBeenCalledWith("job:error", {
        message: "Unable to subscribe to job",
      });
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe("job:unsubscribe", () => {
    it("should ignore invalid jobId types and formats without leaving", () => {
      eventHandlers["job:unsubscribe"](null);
      eventHandlers["job:unsubscribe"]("not-valid-hex");

      expect(socket.leave).not.toHaveBeenCalled();
    });

    it("should leave the room 'job:<jobId>' for valid jobId", () => {
      eventHandlers["job:unsubscribe"](validJobId);

      expect(socket.leave).toHaveBeenCalledWith(`job:${validJobId}`);
    });
  });
});

