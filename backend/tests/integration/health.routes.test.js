import { describe, it, expect } from "vitest";
import request from "supertest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const app = require("../../src/app");

describe("Integration: Health & System Routes", () => {
  it("GET /health should return 200 OK with status and timestamp", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("GET /unknown-route should return 404 with standard error format", async () => {
    const res = await request(app).get("/unknown-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: "Route not found",
    });
  });

  it("should attach security headers via Helmet middleware", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
