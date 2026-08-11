import { hash } from "bcrypt";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { CatalogClient } from "../../src/catalog/ticketmaster-client.js";
import { prisma } from "../../src/database/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required for event tests");
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

const publishResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.literal("PUBLISHED"),
    capacity: z.number().int().positive(),
  })
  .passthrough();

let eventId: string;

describe("POST /api/events/:eventId/publish", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();

    const organizer = await prisma.user.create({
      data: {
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "ORGANIZER",
      },
    });

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        ticketmasterId: "ticketmaster-event-1",
        title: "Festival Plateia",
        imageUrl: "https://images.example/festival.jpg",
        classification: "Music",
        externalUrl: "https://ticketmaster.example/events/1",
        catalogFetchedAt: new Date(),
        startsAt: new Date("2099-08-20T23:00:00.000Z"),
        venueName: "Teatro Plateia",
        address: "Rua da Cultura, 100",
        city: "São Paulo",
        state: "SP",
        priceInCents: 15_000,
        seats: {
          create: [
            {
              rowLabel: "A",
              number: 1,
            },
            {
              rowLabel: "A",
              number: 2,
            },
          ],
        },
      },
    });

    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("publishes a valid draft owned by the organizer", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    const body = publishResponseSchema.parse(response.body);

    expect(body.id).toBe(eventId);
    expect(body.status).toBe("PUBLISHED");
    expect(body.capacity).toBe(2);

    const storedEvent = await prisma.event.findUniqueOrThrow({
      where: {
        id: eventId,
      },
    });

    expect(storedEvent.status).toBe("PUBLISHED");
  });

  it("hides an event owned by another organizer", async () => {
    await prisma.user.create({
      data: {
        name: "Outro Organizador",
        email: "other-organizer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "ORGANIZER",
      },
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "other-organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "EVENT_NOT_FOUND",
        message: "Event not found",
      },
    });
  });

  it("rejects an event that is no longer a draft", async () => {
    await prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        status: "PUBLISHED",
      },
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "EVENT_CANNOT_BE_PUBLISHED",
        message: "Event cannot be published",
      },
    });
  });

  it("allows only one concurrent publication", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const responses = await Promise.all([
      request(app)
        .post(`/api/events/${eventId}/publish`)
        .set("Authorization", `Bearer ${token}`),
      request(app)
        .post(`/api/events/${eventId}/publish`)
        .set("Authorization", `Bearer ${token}`),
    ]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([
      200, 409,
    ]);

    const storedEvent = await prisma.event.findUniqueOrThrow({
      where: {
        id: eventId,
      },
    });

    expect(storedEvent.status).toBe("PUBLISHED");
  });
});
