import { describe, it, expect, vi } from "vitest";
import { validateCreateJob } from "../../../src/middleware/validateRequest.js";
import { JOB_TYPES } from "../../../src/config/constant.js";

describe("Middleware: validateRequest", () => {
  const createMockReqResNext = (body = {}) => {
    const req = { body };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  it("should pass validation for valid job type with defaults", () => {
    const { req, res, next } = createMockReqResNext({
      type: JOB_TYPES.EMAIL,
      payload: { to: "user@example.com", subject: "Welcome" },
    });

    validateCreateJob(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body.priority).toBe(0);
    expect(req.body.maxAttempts).toBe(3);
    expect(req.body.payload).toEqual({
      to: "user@example.com",
      subject: "Welcome",
    });
  });

  it("should preserve custom priority and maxAttempts", () => {
    const { req, res, next } = createMockReqResNext({
      type: JOB_TYPES.EMAIL,
      priority: 5,
      maxAttempts: 10,
    });

    validateCreateJob(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.priority).toBe(5);
    expect(req.body.maxAttempts).toBe(10);
  });

  it("should reject with 400 when type is missing", () => {
    const { req, res, next } = createMockReqResNext({
      payload: { to: "user@example.com" },
    });

    validateCreateJob(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation Error",
        details: expect.arrayContaining([
          expect.objectContaining({ field: "type" }),
        ]),
      })
    );
  });

  it("should reject with 400 when type is not an allowed enum value", () => {
    const { req, res, next } = createMockReqResNext({
      type: "invalid_job_type",
    });

    validateCreateJob(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation Error",
        details: expect.arrayContaining([
          expect.objectContaining({
            field: "type",
            message: expect.stringMatching(/Invalid/i),
          }),
        ]),
      })
    );
  });

  it("should reject with 400 when priority is negative", () => {
    const { req, res, next } = createMockReqResNext({
      type: JOB_TYPES.EMAIL,
      priority: -1,
    });

    validateCreateJob(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation Error",
        details: expect.arrayContaining([
          expect.objectContaining({
            field: "priority",
            message: "Priority must be a non-negative number",
          }),
        ]),
      })
    );
  });

  it("should reject with 400 when maxAttempts is less than 1", () => {
    const { req, res, next } = createMockReqResNext({
      type: JOB_TYPES.EMAIL,
      maxAttempts: 0,
    });

    validateCreateJob(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation Error",
        details: expect.arrayContaining([
          expect.objectContaining({
            field: "maxAttempts",
            message: "maxAttempts must be at least 1",
          }),
        ]),
      })
    );
  });
});
