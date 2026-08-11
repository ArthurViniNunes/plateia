import { compare } from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";
import { z } from "zod";

const app = createApp({
  corsOrigin: "http://localhost:5173",
  jwtSecret: "local-test-secret-with-at-least-32-characters",
});

const registrationResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.literal("CUSTOMER"),
  })
  .strict();

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a customer without authenticating them", async () => {
    const password = "strong-password";

    const response = await request(app).post("/api/auth/register").send({
      name: "  Arthur Vinicius Carneiro Nunes  ",
      email: "  ARTHUR@EXAMPLE.COM  ",
      password,
    });

    expect(response.status).toBe(201);
    const body = registrationResponseSchema.parse(response.body);

    expect(body.name).toBe("Arthur Vinicius Carneiro Nunes");
    expect(body.email).toBe("arthur@example.com");
    expect(body.role).toBe("CUSTOMER");

    const storedUser = await prisma.user.findUnique({
      where: {
        email: "arthur@example.com",
      },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe(password);
    expect(await compare(password, storedUser?.passwordHash ?? "")).toBe(true);
  });

  it("rejects invalid registration data", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "invalid-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });

    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects an email that is already registered", async () => {
    const registration = {
      name: "Arthur Vinicius Carneiro Nunes",
      email: "arthur@example.com",
      password: "strong-password",
    };

    const firstResponse = await request(app)
      .post("/api/auth/register")
      .send(registration);

    const duplicateResponse = await request(app)
      .post("/api/auth/register")
      .send({
        ...registration,
        email: "  ARTHUR@EXAMPLE.COM  ",
      });

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        message: "Email already registered",
      },
    });
    expect(await prisma.user.count()).toBe(1);
  });
});
