import { hash } from "bcrypt";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import {
  TicketmasterUnavailableError,
  type CatalogClient,
} from "../../src/catalog/ticketmaster-client.js";
import { resetDatabase } from "../helpers/reset-database.js";
import { prisma } from "../../src/database/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required for catalog tests");
}

const searchEvents = vi.fn<CatalogClient["searchEvents"]>();
const getEventById = vi.fn<CatalogClient["getEventById"]>();

const app = createApp({
  corsOrigin: "http://localhost:5173",
  jwtSecret,
  catalogClient: {
    searchEvents,
    getEventById,
  },
});

const loginResponseSchema = z.object({
  token: z.string().min(1),
});

describe("GET /api/catalog/events", () => {
  beforeEach(async () => {
    await resetDatabase();

    await prisma.user.create({
      data: {
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "ORGANIZER",
      },
    });

    getEventById.mockReset();
    searchEvents.mockReset();
    searchEvents.mockResolvedValue([
      {
        id: "ticketmaster-event-1",
        title: "Festival Plateia",
        imageUrl: "https://images.example/festival.jpg",
        classification: "Music",
        externalUrl: "https://ticketmaster.example/events/1",
      },
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows an organizer to search the external catalog", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/catalog/events")
      .query({
        query: "  festival  ",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      events: [
        {
          id: "ticketmaster-event-1",
          title: "Festival Plateia",
          imageUrl: "https://images.example/festival.jpg",
          classification: "Music",
          externalUrl: "https://ticketmaster.example/events/1",
        },
      ],
    });
    expect(searchEvents).toHaveBeenCalledExactlyOnceWith("festival");
  });

  it("rejects an invalid search query", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/catalog/events")
      .query({
        query: "a",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });
    expect(searchEvents).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated catalog search", async () => {
    const response = await request(app).get("/api/catalog/events").query({
      query: "festival",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
    expect(searchEvents).not.toHaveBeenCalled();
  });

  it("rejects a customer catalog search", async () => {
    await prisma.user.create({
      data: {
        name: "Cliente Plateia",
        email: "customer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "CUSTOMER",
      },
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/catalog/events")
      .query({
        query: "festival",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
    expect(searchEvents).not.toHaveBeenCalled();
  });

  it("reports Ticketmaster unavailability", async () => {
    searchEvents.mockRejectedValueOnce(new TicketmasterUnavailableError());

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/catalog/events")
      .query({
        query: "festival",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "TICKETMASTER_UNAVAILABLE",
        message: "Ticketmaster catalog is unavailable",
      },
    });
  });
});
