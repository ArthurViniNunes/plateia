import { hash } from "bcrypt";
import { jwtVerify } from "jose";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required for authentication tests");
}

const app = createApp({
  corsOrigin: "http://localhost:5173",
  jwtSecret,
});

const loginResponseSchema = z
  .object({
    token: z.string().min(1),
    user: z
      .object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
        role: z.literal("CUSTOMER"),
      })
      .strict(),
  })
  .strict();

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        name: "Arthur Vinicius Carneiro Nunes",
        email: "arthur@example.com",
        passwordHash: await hash("strong-password", 12),
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("authenticates valid credentials and returns an eight-hour JWT", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "  ARTHUR@EXAMPLE.COM  ",
      password: "strong-password",
    });

    expect(response.status).toBe(200);

    const body = loginResponseSchema.parse(response.body);

    expect(body.user).toMatchObject({
      name: "Arthur Vinicius Carneiro Nunes",
      email: "arthur@example.com",
      role: "CUSTOMER",
    });

    const { payload, protectedHeader } = await jwtVerify(
      body.token,
      new TextEncoder().encode(jwtSecret),
      {
        issuer: "plateia-api",
        audience: "plateia-web",
      },
    );

    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe(body.user.id);
    expect(payload.role).toBe("CUSTOMER");
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(8 * 60 * 60);
  });

  it("rejects malformed login data", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "invalid-email",
      password: "",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });
  });

  it("returns the same error for an unknown email and an incorrect password", async () => {
    const unknownEmailResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "unknown@example.com",
        password: "strong-password",
      });

    const incorrectPasswordResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "arthur@example.com",
        password: "incorrect-password",
      });

    const expectedError = {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    };

    expect(unknownEmailResponse.status).toBe(401);
    expect(incorrectPasswordResponse.status).toBe(401);
    expect(unknownEmailResponse.body).toEqual(expectedError);
    expect(incorrectPasswordResponse.body).toEqual(expectedError);
  });
});