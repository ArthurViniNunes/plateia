import { hash } from "bcrypt";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";

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

const loginResponseSchema = z.object({
  token: z.string().min(1),
});

const meResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.literal("CUSTOMER"),
  })
  .strict();

describe("GET /api/auth/me", () => {
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

  it("returns the authenticated user", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "arthur@example.com",
      password: "strong-password",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    const body = meResponseSchema.parse(response.body);

    expect(body.name).toBe("Arthur Vinicius Carneiro Nunes");
    expect(body.email).toBe("arthur@example.com");
    expect(body.role).toBe("CUSTOMER");
  });

  it("rejects a request without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects a malformed token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects an expired token", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: "arthur@example.com",
      },
    });

    const expiredToken = await new SignJWT({
      role: user.role,
    })
      .setProtectedHeader({
        alg: "HS256",
      })
      .setSubject(user.id)
      .setIssuer("plateia-api")
      .setAudience("plateia-web")
      .setIssuedAt(0)
      .setExpirationTime(1)
      .sign(new TextEncoder().encode(jwtSecret));

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects a valid token when the user no longer exists", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "arthur@example.com",
      password: "strong-password",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    await prisma.user.deleteMany();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});
