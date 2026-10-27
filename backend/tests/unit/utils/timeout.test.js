import { describe, it, expect, vi } from "vitest";
import { withTimeout } from "../../../src/utils/timeout.js";

describe("Utils: withTimeout", () => {
  it("should resolve successfully when task completes before timeout", async () => {
    const task = vi.fn().mockImplementation(async (signal) => {
      expect(signal.aborted).toBe(false);
      return "task-result";
    });

    const result = await withTimeout(task, 1000);
    expect(result).toBe("task-result");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("should reject with TimeoutError when task exceeds timeout limit", async () => {
    const slowTask = (signal) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve("too late"), 500);
        signal.addEventListener("abort", () => clearTimeout(timer));
      });

    await expect(withTimeout(slowTask, 50)).rejects.toThrowError(
      "Job Execution Timed Out after 50ms"
    );
  });

  it("should trigger abort signal on timeout", async () => {
    let wasAborted = false;

    const slowTask = (signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          wasAborted = true;
          // task remains unfulfilled or aborted
        });
      });

    await expect(withTimeout(slowTask, 50)).rejects.toThrow("Timed Out");
    expect(wasAborted).toBe(true);
  });

  it("should propagate error when the task itself throws/rejects", async () => {
    const failingTask = async () => {
      throw new Error("Task execution internal failure");
    };

    await expect(withTimeout(failingTask, 1000)).rejects.toThrow(
      "Task execution internal failure"
    );
  });
});
