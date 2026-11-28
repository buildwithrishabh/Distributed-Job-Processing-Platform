import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  isValidTimeZone,
  computeNextRunAt,
} = require("../../../src/utils/cronHelper");

describe("Utils: cronHelper", () => {
  describe("isValidTimeZone", () => {
    it("accepts valid IANA timezones", () => {
      expect(isValidTimeZone("UTC")).toBe(true);
      expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
      expect(isValidTimeZone("America/New_York")).toBe(true);
    });

    it("rejects invalid timezone strings", () => {
      expect(isValidTimeZone("Mars/Olympus")).toBe(false);
      expect(isValidTimeZone("")).toBe(false);
    });
  });

  describe("computeNextRunAt", () => {
    it("computes next UTC run for America/New_York (EST = UTC-5)", () => {
      const from = new Date("2026-01-01T00:00:00.000Z");
      const next = computeNextRunAt("0 9 * * *", "America/New_York", from);
      expect(next).toBeInstanceOf(Date);
      expect(next.toISOString()).toBe("2026-01-01T14:00:00.000Z");
    });

    it("computes next UTC run for Asia/Kolkata (IST = UTC+5:30)", () => {
      const from = new Date("2026-01-01T00:00:00.000Z");
      const next = computeNextRunAt("0 9 * * *", "Asia/Kolkata", from);
      expect(next).toBeInstanceOf(Date);
      expect(next.toISOString()).toBe("2026-01-01T03:30:00.000Z");
    });

    it("throws on malformed cron expressions", () => {
      expect(() => computeNextRunAt("not a cron", "UTC")).toThrow();
    });
  });
});
