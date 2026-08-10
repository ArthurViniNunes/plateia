import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env.js";

const validEnvironment = {
  PORT: "3333",
  CORS_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const result = parseEnv(validEnvironment);

    expect(result).toEqual({
      PORT: 3333,
      CORS_ORIGIN: "http://localhost:5173",
      JWT_SECRET: "a".repeat(32),
    });
  });

  it("rejects an environment without required variables", () => {
    expect(() => parseEnv({})).toThrow();
  });

  it("rejects an invalid port", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        PORT: "70000",
      }),
    ).toThrow();
  });

  it("rejects an invalid CORS origin", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        CORS_ORIGIN: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects a JWT secret shorter than 32 characters", () => {
    expect(() =>
      parseEnv({
        ...validEnvironment,
        JWT_SECRET: "short-secret",
      }),
    ).toThrow();
  });
});