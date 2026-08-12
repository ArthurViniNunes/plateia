import { hash } from "bcrypt";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { CatalogClient } from "../../src/catalog/ticketmaster-client.js";
import { prisma } from "../../src/database/prisma.js";
import { resetDatabase } from "../helpers/reset-database.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required for gate tests");
}

const searchEvents = vi.fn<CatalogClient["searchEvents"]>();
const getEventById = vi.fn<CatalogClient["getEventById"]>();

const loginResponseSchema = z.object({
  token: z.string().min(1),
});

const validResponseSchema = z.object({
  result: z.literal("VALID"),
  validatedAt: z.iso.datetime(),
  ticket: z.object({
    id: z.uuid(),
    eventId: z.uuid(),
    seat: z.object({
      rowLabel: z.string(),
      number: z.number().int().positive(),
    }),
  }),
});

const gateResultSchema = z.object({
  result: z.enum(["VALID", "INVALID", "ALREADY_USED", "WRONG_EVENT"]),
});

const app = createApp({
  corsOrigin: "http://localhost:5173",
  jwtSecret,
  catalogClient: {
    searchEvents,
    getEventById,
  },
});

let eventId: string;
let ticketId: string;
let ticketCode: string;

async function loginAsGatekeeper() {
  const response = await request(app).post("/api/auth/login").send({
    email: "gatekeeper@plateia.local",
    password: "Plateia123!",
  });

  expect(response.status, response.text).toBe(200);

  return loginResponseSchema.parse(response.body).token;
}

describe("POST /api/gate/validate", () => {
  beforeEach(async () => {
    await resetDatabase();

    const [organizer, customer] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Organizador Plateia",
          email: "organizer@plateia.local",
          passwordHash: await hash("Plateia123!", 12),
          role: "ORGANIZER",
        },
      }),
      prisma.user.create({
        data: {
          name: "Cliente Plateia",
          email: "customer@plateia.local",
          passwordHash: await hash("Plateia123!", 12),
          role: "CUSTOMER",
        },
      }),
      prisma.user.create({
        data: {
          name: "Portaria Plateia",
          email: "gatekeeper@plateia.local",
          passwordHash: await hash("Plateia123!", 12),
          role: "GATEKEEPER",
        },
      }),
    ]);

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        ticketmasterId: "ticketmaster-gate-event",
        title: "Festival Plateia",
        catalogFetchedAt: new Date(),
        startsAt: new Date("2099-08-20T23:00:00.000Z"),
        venueName: "Teatro Plateia",
        address: "Rua da Cultura, 100",
        city: "Fortaleza",
        state: "CE",
        priceInCents: 15_000,
        status: "PUBLISHED",
        seats: {
          create: {
            rowLabel: "A",
            number: 1,
          },
        },
      },
      include: {
        seats: true,
      },
    });

    const seat = z
      .object({
        id: z.uuid(),
      })
      .parse(event.seats[0]);

    const reservation = await prisma.reservation.create({
      data: {
        customerId: customer.id,
        eventId: event.id,
        status: "PAID",
        expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
        totalInCents: 15_000,
        seats: {
          create: {
            seatId: seat.id,
            priceInCents: 15_000,
          },
        },
      },
    });

    const ticket = await prisma.ticket.create({
      data: {
        reservationId: reservation.id,
        customerId: customer.id,
        eventId: event.id,
        seatId: seat.id,
        code: "gate-ticket-code-with-at-least-thirty-two-characters",
      },
    });

    eventId = event.id;
    ticketId = ticket.id;
    ticketCode = ticket.code;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("validates an unused ticket for the selected event", async () => {
    const token = await loginAsGatekeeper();
    const beforeRequest = Date.now();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: ticketCode,
      });

    const afterRequest = Date.now();

    expect(response.status, response.text).toBe(200);

    const body = validResponseSchema.parse(response.body);
    const validatedAt = new Date(body.validatedAt).getTime();

    expect(body.ticket).toEqual({
      id: ticketId,
      eventId,
      seat: {
        rowLabel: "A",
        number: 1,
      },
    });

    expect(validatedAt).toBeGreaterThanOrEqual(beforeRequest);
    expect(validatedAt).toBeLessThanOrEqual(afterRequest);

    const storedTicket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(storedTicket.usedAt?.getTime()).toBe(validatedAt);
  });

  it("returns invalid for an unknown ticket code", async () => {
    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: "unknown-ticket-code",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: "INVALID",
    });
  });

  it("returns already used without changing the validation time", async () => {
    const usedAt = new Date("2098-01-01T12:00:00.000Z");

    await prisma.ticket.update({
      where: {
        id: ticketId,
      },
      data: {
        usedAt,
      },
    });

    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: ticketCode,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: "ALREADY_USED",
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(ticket.usedAt).toEqual(usedAt);
  });

  it("returns wrong event without using the ticket", async () => {
    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId: crypto.randomUUID(),
        code: ticketCode,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: "WRONG_EVENT",
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(ticket.usedAt).toBeNull();
  });

  it("returns invalid for a ticket from a cancelled event", async () => {
    await prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: ticketCode,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: "INVALID",
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(ticket.usedAt).toBeNull();
  });

  it("allows only one concurrent validation", async () => {
    const token = await loginAsGatekeeper();

    const validate = () =>
      request(app)
        .post("/api/gate/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventId,
          code: ticketCode,
        });

    const responses = await Promise.all([validate(), validate()]);

    const results = responses
      .map(({ body }) => gateResultSchema.parse(body).result)
      .toSorted();

    expect(results).toEqual(["ALREADY_USED", "VALID"]);
    expect(responses.every(({ status }) => status === 200)).toBe(true);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(ticket.usedAt).not.toBeNull();
  });

  it("rejects an unauthenticated validation", async () => {
    const response = await request(app).post("/api/gate/validate").send({
      eventId,
      code: ticketCode,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects validation by a customer", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: ticketCode,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });

  it("rejects malformed validation data", async () => {
    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId: "not-a-uuid",
        code: "",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });
  });

  it("returns invalid after the six-hour validation window", async () => {
    await prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        startsAt: new Date(Date.now() - 6 * 60 * 60 * 1_000 - 60_000),
      },
    });

    const token = await loginAsGatekeeper();

    const response = await request(app)
      .post("/api/gate/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        eventId,
        code: ticketCode,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: "INVALID",
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: ticketId,
      },
    });

    expect(ticket.usedAt).toBeNull();
  });
});
