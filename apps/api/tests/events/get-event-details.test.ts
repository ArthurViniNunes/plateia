import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { CatalogClient } from "../../src/catalog/ticketmaster-client.js";
import { prisma } from "../../src/database/prisma.js";

import { resetDatabase } from "../helpers/reset-database.js";

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

const eventDetailsSchema = z.object({
  id: z.uuid(),
  ticketmasterId: z.string(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  classification: z.string().nullable(),
  externalUrl: z.string().nullable(),
  startsAt: z.iso.datetime(),
  venue: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  priceInCents: z.number().int().positive(),
  status: z.literal("PUBLISHED"),
  capacity: z.number().int().positive(),
  rows: z.array(
    z.object({
      label: z.string(),
      seats: z.array(
        z.object({
          id: z.uuid(),
          number: z.number().int().positive(),
          status: z.literal("AVAILABLE"),
        }),
      ),
    }),
  ),
});

const notFoundResponseSchema = z.object({
  error: z.object({
    code: z.literal("EVENT_NOT_FOUND"),
    message: z.literal("Event not found"),
  }),
});

let organizerId: string;

interface CreateEventOptions {
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
  startsAt?: string;
}

async function createEvent({
  status = "PUBLISHED",
  startsAt = "2099-08-20T23:00:00.000Z",
}: CreateEventOptions = {}) {
  return prisma.event.create({
    data: {
      organizerId,
      ticketmasterId: crypto.randomUUID(),
      title: "Festival Plateia",
      imageUrl: "https://images.example/festival.jpg",
      classification: "Music",
      externalUrl: "https://ticketmaster.example/festival",
      catalogFetchedAt: new Date(),
      startsAt: new Date(startsAt),
      venueName: "Teatro Plateia",
      address: "Rua da Cultura, 100",
      city: "Fortaleza",
      state: "CE",
      priceInCents: 15_000,
      status,
      seats: {
        create: [
          {
            rowLabel: "B",
            number: 2,
          },
          {
            rowLabel: "A",
            number: 2,
          },
          {
            rowLabel: "B",
            number: 1,
          },
          {
            rowLabel: "A",
            number: 1,
          },
        ],
      },
    },
    include: {
      seats: true,
    },
  });
}

describe("GET /api/events/:eventId", () => {
  beforeEach(async () => {
    await resetDatabase();

    const organizer = await prisma.user.create({
      data: {
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        passwordHash: "not-used-by-public-event-tests",
        role: "ORGANIZER",
      },
    });

    organizerId = organizer.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns a future published event with its ordered seat map", async () => {
    const event = await createEvent();

    const response = await request(app).get(`/api/events/${event.id}`);

    expect(response.status).toBe(200);

    const body = eventDetailsSchema.parse(response.body);

    expect(body.id).toBe(event.id);
    expect(body.capacity).toBe(4);
    expect(body.rows).toEqual([
      {
        label: "A",
        seats: [
          {
            id: event.seats.find(
              ({ rowLabel, number }) => rowLabel === "A" && number === 1,
            )?.id,
            number: 1,
            status: "AVAILABLE",
          },
          {
            id: event.seats.find(
              ({ rowLabel, number }) => rowLabel === "A" && number === 2,
            )?.id,
            number: 2,
            status: "AVAILABLE",
          },
        ],
      },
      {
        label: "B",
        seats: [
          {
            id: event.seats.find(
              ({ rowLabel, number }) => rowLabel === "B" && number === 1,
            )?.id,
            number: 1,
            status: "AVAILABLE",
          },
          {
            id: event.seats.find(
              ({ rowLabel, number }) => rowLabel === "B" && number === 2,
            )?.id,
            number: 2,
            status: "AVAILABLE",
          },
        ],
      },
    ]);
  });

  it.each([
    ["a draft event", "DRAFT" as const, "2099-08-20T23:00:00.000Z"],
    ["a cancelled event", "CANCELLED" as const, "2099-08-20T23:00:00.000Z"],
    ["a past event", "PUBLISHED" as const, "2000-08-20T23:00:00.000Z"],
  ])("hides %s", async (_description, status, startsAt) => {
    const event = await createEvent({
      status,
      startsAt,
    });

    const response = await request(app).get(`/api/events/${event.id}`);

    expect(response.status).toBe(404);

    expect(notFoundResponseSchema.parse(response.body)).toEqual({
      error: {
        code: "EVENT_NOT_FOUND",
        message: "Event not found",
      },
    });
  });

  it("returns not found for an unknown event", async () => {
    const response = await request(app).get(
      `/api/events/${crypto.randomUUID()}`,
    );

    expect(response.status).toBe(404);

    expect(notFoundResponseSchema.parse(response.body)).toEqual({
      error: {
        code: "EVENT_NOT_FOUND",
        message: "Event not found",
      },
    });
  });

  it("returns not found for a malformed event identifier", async () => {
    const response = await request(app).get("/api/events/not-a-uuid");

    expect(response.status).toBe(404);

    expect(notFoundResponseSchema.parse(response.body)).toEqual({
      error: {
        code: "EVENT_NOT_FOUND",
        message: "Event not found",
      },
    });
  });
});
