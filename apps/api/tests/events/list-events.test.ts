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

const eventSummarySchema = z.object({
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
});

const listEventsResponseSchema = z.object({
  data: z.array(eventSummarySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

let organizerId: string;

interface CreateEventOptions {
  ticketmasterId: string;
  title: string;
  startsAt: string;
  city?: string;
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
}

async function createEvent({
  ticketmasterId,
  title,
  startsAt,
  city = "Fortaleza",
  status = "PUBLISHED",
}: CreateEventOptions) {
  return prisma.event.create({
    data: {
      organizerId,
      ticketmasterId,
      title,
      imageUrl: `https://images.example/${ticketmasterId}.jpg`,
      classification: "Music",
      externalUrl: `https://ticketmaster.example/${ticketmasterId}`,
      catalogFetchedAt: new Date(),
      startsAt: new Date(startsAt),
      venueName: "Teatro Plateia",
      address: "Rua da Cultura, 100",
      city,
      state: "CE",
      priceInCents: 15_000,
      status,
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
}

describe("GET /api/events", () => {
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

  it("lists only future published events without authentication", async () => {
    await createEvent({
      ticketmasterId: "published-later",
      title: "Festival de Encerramento",
      startsAt: "2099-08-20T23:00:00.000Z",
    });

    await createEvent({
      ticketmasterId: "published-sooner",
      title: "Festival de Abertura",
      startsAt: "2099-08-15T23:00:00.000Z",
    });

    await createEvent({
      ticketmasterId: "draft",
      title: "Evento em Rascunho",
      startsAt: "2099-08-10T23:00:00.000Z",
      status: "DRAFT",
    });

    await createEvent({
      ticketmasterId: "cancelled",
      title: "Evento Cancelado",
      startsAt: "2099-08-11T23:00:00.000Z",
      status: "CANCELLED",
    });

    await createEvent({
      ticketmasterId: "past",
      title: "Evento Passado",
      startsAt: "2000-08-20T23:00:00.000Z",
    });

    const response = await request(app).get("/api/events");

    expect(response.status).toBe(200);

    const body = listEventsResponseSchema.parse(response.body);

    expect(body.data.map(({ title }) => title)).toEqual([
      "Festival de Abertura",
      "Festival de Encerramento",
    ]);

    expect(body.pagination).toEqual({
      page: 1,
      limit: 12,
      total: 2,
      totalPages: 1,
    });
  });

  it("filters events and paginates the result", async () => {
    await createEvent({
      ticketmasterId: "fortaleza-first",
      title: "Festival Cultural",
      startsAt: "2099-08-15T20:00:00.000Z",
      city: "Fortaleza",
    });

    await createEvent({
      ticketmasterId: "fortaleza-second",
      title: "Festival de Música",
      startsAt: "2099-08-20T20:00:00.000Z",
      city: "Fortaleza",
    });

    await createEvent({
      ticketmasterId: "different-city",
      title: "Festival de Cinema",
      startsAt: "2099-08-18T20:00:00.000Z",
      city: "São Paulo",
    });

    await createEvent({
      ticketmasterId: "different-title",
      title: "Mostra Cultural",
      startsAt: "2099-08-19T20:00:00.000Z",
      city: "Fortaleza",
    });

    const response = await request(app).get("/api/events").query({
      search: "FESTIVAL",
      city: "fortaleza",
      startsFrom: "2099-08-01",
      startsTo: "2099-08-31",
      page: 2,
      limit: 1,
    });

    expect(response.status).toBe(200);

    const body = listEventsResponseSchema.parse(response.body);

    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.title).toBe("Festival de Música");
    expect(body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it.each([
    ["page equal to zero", { page: "0" }],
    ["limit above the maximum", { limit: "51" }],
    ["invalid initial date", { startsFrom: "not-a-date" }],
    [
      "an inverted date interval",
      {
        startsFrom: "2099-08-31",
        startsTo: "2099-08-01",
      },
    ],
  ])("rejects %s", async (_description, query) => {
    const response = await request(app).get("/api/events").query(query);

    expect(response.status).toBe(400);

    const body = errorResponseSchema.parse(response.body);

    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters",
      },
    });
  });
});
