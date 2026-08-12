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
  throw new Error("JWT_SECRET is required for ticket tests");
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

const ticketSchema = z.object({
  id: z.uuid(),
  code: z.string().min(32),
  status: z.enum(["VALID", "USED", "CANCELLED"]),
  event: z.object({
    id: z.uuid(),
    title: z.string(),
    startsAt: z.iso.datetime(),
    venue: z.object({
      name: z.string(),
      city: z.string(),
      state: z.string(),
    }),
  }),
  seat: z.object({
    id: z.uuid(),
    rowLabel: z.string(),
    number: z.number().int().positive(),
  }),
  sharePath: z.string(),
});

const ticketsResponseSchema = z.object({
  tickets: z.array(ticketSchema),
});

let ticketCode: string;
let ticketId: string;
let eventId: string;
let seatId: string;

describe("ticket queries", () => {
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
    ]);

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        ticketmasterId: "ticketmaster-ticket-event",
        title: "Festival Plateia",
        imageUrl: "https://images.example/festival.jpg",
        classification: "Music",
        externalUrl: "https://ticketmaster.example/festival",
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
        code: "ticket-code-with-at-least-thirty-two-characters",
      },
    });

    ticketCode = ticket.code;
    ticketId = ticket.id;
    eventId = event.id;
    seatId = seat.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists only the authenticated customer's tickets", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/tickets")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status, response.text).toBe(200);

    const body = ticketsResponseSchema.parse(response.body);

    expect(body.tickets).toEqual([
      {
        id: ticketId,
        code: ticketCode,
        status: "VALID",
        event: {
          id: eventId,
          title: "Festival Plateia",
          startsAt: "2099-08-20T23:00:00.000Z",
          venue: {
            name: "Teatro Plateia",
            city: "Fortaleza",
            state: "CE",
          },
        },
        seat: {
          id: seatId,
          rowLabel: "A",
          number: 1,
        },
        sharePath: `/tickets/${ticketCode}`,
      },
    ]);
  });

  it("allows anyone with the code to view the shared ticket", async () => {
    const response = await request(app).get(`/api/tickets/${ticketCode}`);

    expect(response.status, response.text).toBe(200);

    const body = ticketSchema.parse(response.body);

    expect(body.id).toBe(ticketId);
    expect(body.code).toBe(ticketCode);
    expect(body).not.toHaveProperty("customer");
    expect(body).not.toHaveProperty("customerId");
  });

  it("returns not found for an unknown ticket code", async () => {
    const response = await request(app).get("/api/tickets/unknown-ticket-code");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "TICKET_NOT_FOUND",
        message: "Ticket not found",
      },
    });
  });

  it("shows a ticket as used when it has already been validated", async () => {
    await prisma.ticket.update({
      where: {
        id: ticketId,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const response = await request(app).get(`/api/tickets/${ticketCode}`);

    expect(response.status, response.text).toBe(200);
    expect(ticketSchema.parse(response.body).status).toBe("USED");
  });

  it("shows a ticket as cancelled when its event was cancelled", async () => {
    await prisma.ticket.update({
      where: {
        id: ticketId,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    const response = await request(app).get(`/api/tickets/${ticketCode}`);

    expect(response.status, response.text).toBe(200);
    expect(ticketSchema.parse(response.body).status).toBe("CANCELLED");
  });
});
