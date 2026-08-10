import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env.js";

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const result = parseEnv({
      PORT: "3333",
      CORS_ORIGIN: "http://localhost:5173",
    });

    expect(result).toEqual({
      PORT: 3333,
      CORS_ORIGIN: "http://localhost:5173",
    });
  });

  it("rejects an environment without required variables", () => {
    expect(() => parseEnv({})).toThrow();
  });

  it("rejects an invalid port", () => {
    expect(() =>
      parseEnv({
        PORT: "70000",
        CORS_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow();
  });

  it("rejects an invalid CORS origin", () => {
    expect(() =>
      parseEnv({
        PORT: "3333",
        CORS_ORIGIN: "not-a-url",
      }),
    ).toThrow();
  });
});