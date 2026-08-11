import { hash } from "bcrypt";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import {
  CatalogEventNotFoundError,
  TicketmasterUnavailableError,
  type CatalogClient,
} from "../../src/catalog/ticketmaster-client.js";
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

const createEventResponseSchema = z
  .object({
    id: z.uuid(),
    ticketmasterId: z.string(),
    title: z.string(),
    imageUrl: z.url().nullable(),
    classification: z.string().nullable(),
    externalUrl: z.url().nullable(),
    startsAt: z.string(),
    venue: z
      .object({
        name: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
      })
      .strict(),
    priceInCents: z.number().int(),
    status: z.literal("DRAFT"),
    capacity: z.number().int(),
  })
  .strict();

function createValidEventRequest() {
  return {
    ticketmasterId: "ticketmaster-event-1",
    startsAt: "2099-08-20T20:00:00-03:00",
    venue: {
      name: "Teatro Plateia",
      address: "Rua da Cultura, 100",
      city: "São Paulo",
      state: "SP",
    },
    priceInCents: 15_000,
    rows: [
      {
        label: "A",
        seatCount: 2,
      },
    ],
  };
}

describe("POST /api/events", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "ORGANIZER",
      },
    });

    searchEvents.mockReset();
    getEventById.mockReset();

    getEventById.mockResolvedValue({
      id: "ticketmaster-event-1",
      title: "Festival Plateia",
      imageUrl: "https://images.example/festival.jpg",
      classification: "Music",
      externalUrl: "https://ticketmaster.example/events/1",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a draft event and all its seats transactionally", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ticketmasterId: "  ticketmaster-event-1  ",
        startsAt: "2099-08-20T20:00:00-03:00",
        venue: {
          name: "  Teatro Plateia  ",
          address: "  Rua da Cultura, 100  ",
          city: "  São Paulo  ",
          state: "sp",
        },
        priceInCents: 15_000,
        rows: [
          {
            label: " a ",
            seatCount: 2,
          },
          {
            label: "b",
            seatCount: 1,
          },
        ],
      });

    expect(response.status).toBe(201);

    const body = createEventResponseSchema.parse(response.body);

    expect(body).toMatchObject({
      ticketmasterId: "ticketmaster-event-1",
      title: "Festival Plateia",
      imageUrl: "https://images.example/festival.jpg",
      classification: "Music",
      externalUrl: "https://ticketmaster.example/events/1",
      startsAt: "2099-08-20T23:00:00.000Z",
      venue: {
        name: "Teatro Plateia",
        address: "Rua da Cultura, 100",
        city: "São Paulo",
        state: "SP",
      },
      priceInCents: 15_000,
      status: "DRAFT",
      capacity: 3,
    });

    expect(getEventById).toHaveBeenCalledExactlyOnceWith(
      "ticketmaster-event-1",
    );

    const storedEvent = await prisma.event.findUnique({
      where: {
        id: body.id,
      },
      include: {
        seats: {
          orderBy: [
            {
              rowLabel: "asc",
            },
            {
              number: "asc",
            },
          ],
        },
      },
    });

    expect(storedEvent).not.toBeNull();
    expect(
      storedEvent?.seats.map(({ rowLabel, number }) => ({
        rowLabel,
        number,
      })),
    ).toEqual([
      {
        rowLabel: "A",
        number: 1,
      },
      {
        rowLabel: "A",
        number: 2,
      },
      {
        rowLabel: "B",
        number: 1,
      },
    ]);
  });

  it("rejects duplicated row labels after normalization", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...createValidEventRequest(),
        rows: [
          {
            label: "A",
            seatCount: 2,
          },
          {
            label: " a ",
            seatCount: 3,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });
    expect(getEventById).not.toHaveBeenCalled();
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects an unauthenticated event creation", async () => {
    const response = await request(app)
      .post("/api/events")
      .send(createValidEventRequest());

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
    expect(getEventById).not.toHaveBeenCalled();
  });

  it("rejects event creation by a customer", async () => {
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
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(createValidEventRequest());

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
    expect(getEventById).not.toHaveBeenCalled();
  });

  it("rejects an unknown catalog event", async () => {
    getEventById.mockRejectedValueOnce(new CatalogEventNotFoundError());

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(createValidEventRequest());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "CATALOG_EVENT_NOT_FOUND",
        message: "Catalog event not found",
      },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects creation while Ticketmaster is unavailable", async () => {
    getEventById.mockRejectedValueOnce(new TicketmasterUnavailableError());

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(createValidEventRequest());

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "TICKETMASTER_UNAVAILABLE",
        message: "Ticketmaster catalog is unavailable",
      },
    });
    expect(await prisma.event.count()).toBe(0);
  });
});
