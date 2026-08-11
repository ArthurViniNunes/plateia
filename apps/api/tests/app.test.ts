import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const allowedOrigin = "http://localhost:5173";
const app = createApp({
  corsOrigin: allowedOrigin,
  jwtSecret: "local-test-secret-with-at-least-32-characters",
});

describe("GET /health", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
    });
  });
});

describe("CORS", () => {
  it("authorizes the configured origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", allowedOrigin);

    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
  });

  it("does not authorize a different origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://malicious.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
