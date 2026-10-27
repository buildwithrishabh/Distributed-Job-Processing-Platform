import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { UnrecoverableError } from "bullmq";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const env = require("../../../src/config/env");
import emailProcessor from "../../../src/processors/email.processor.js";

describe("Processor: emailProcessor", () => {
  const originalFetch = global.fetch;
  const originalApiKey = env.BREVO_API_KEY;

  const mockBullJob = {
    id: "bull-job-123",
    data: { jobId: "job_xyz_789" },
    updateProgress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    env.BREVO_API_KEY = originalApiKey;
  });

  afterAll(() => {
    env.BREVO_API_KEY = originalApiKey;
  });

  describe("Validation & Unrecoverable Errors", () => {
    it("should throw UnrecoverableError if 'to' is missing", async () => {
      await expect(
        emailProcessor({ subject: "Hello" }, mockBullJob)
      ).rejects.toThrow(UnrecoverableError);
    });

    it("should throw UnrecoverableError if 'subject' is missing", async () => {
      await expect(
        emailProcessor({ to: "user@example.com" }, mockBullJob)
      ).rejects.toThrow(UnrecoverableError);
    });

    it("should throw UnrecoverableError if email recipient format is invalid", async () => {
      await expect(
        emailProcessor(
          { to: "invalid-email-address", subject: "Test" },
          mockBullJob
        )
      ).rejects.toThrow(UnrecoverableError);
    });
  });

  describe("Transient Simulation Failure", () => {
    it("should throw standard retryable Error for fail@example.com", async () => {
      await expect(
        emailProcessor(
          { to: "fail@example.com", subject: "Failure test" },
          mockBullJob
        )
      ).rejects.toThrow("SMTP Gateway Connection Timeout (Simulated)");

      try {
        await emailProcessor(
          { to: "fail@example.com", subject: "Failure test" },
          mockBullJob
        );
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(UnrecoverableError);
      }
    });
  });

  describe("Simulated Delivery Mode (No BREVO_API_KEY)", () => {
    it("should deliver successfully in simulation mode when no API key configured", async () => {
      env.BREVO_API_KEY = "";

      const result = await emailProcessor(
        {
          to: "success@example.com",
          subject: "Test Subject",
          body: "Hello world!",
        },
        mockBullJob
      );

      expect(result.delivered).toBe(true);
      expect(result.provider).toBe("simulated");
      expect(result.recipient).toBe("success@example.com");
      expect(mockBullJob.updateProgress).toHaveBeenCalledWith(100);
    });
  });

  describe("Brevo API Live Delivery", () => {
    beforeEach(() => {
      env.BREVO_API_KEY = "test-brevo-key";
    });

    it("should send email via Brevo and return success on 200 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ messageId: "brevo-msg-123" }),
      });

      const result = await emailProcessor(
        {
          to: "real@example.com",
          subject: "Welcome",
          html: "<p>Welcome to our app!</p>",
        },
        mockBullJob
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.brevo.com/v3/smtp/email",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "api-key": "test-brevo-key",
          }),
        })
      );
      expect(result.delivered).toBe(true);
      expect(result.provider).toBe("brevo");
      expect(result.messageId).toBe("brevo-msg-123");
    });

    it("should throw UnrecoverableError when Brevo returns 400 Bad Request", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid email parameters" }),
      });

      await expect(
        emailProcessor(
          {
            to: "blocked@example.com",
            subject: "Welcome",
          },
          mockBullJob
        )
      ).rejects.toThrow(UnrecoverableError);
    });

    it("should throw standard retryable Error when Brevo returns 500 Server Error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal Server Error in Brevo" }),
      });

      try {
        await emailProcessor(
          {
            to: "retry@example.com",
            subject: "Welcome",
          },
          mockBullJob
        );
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(UnrecoverableError);
        expect(err.message).toContain("Brevo API Transient Error (500)");
      }
    });
  });
});
