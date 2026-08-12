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
  throw new Error("JWT_SECRET is required for cancellation tests");
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

const seatSchema = z.object({
  id: z.uuid(),
});

const seatsSchema = z.tuple([seatSchema, seatSchema]);

let eventId: string;
let pendingReservationId: string;
let ticketCode: string;

describe("POST /api/events/:eventId/cancel", () => {
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
        ticketmasterId: "ticketmaster-cancel-event",
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
      include: {
        seats: {
          orderBy: {
            number: "asc",
          },
        },
      },
    });

    const [paidSeat, pendingSeat] = seatsSchema.parse(event.seats);

    const paidReservation = await prisma.reservation.create({
      data: {
        customerId: customer.id,
        eventId: event.id,
        status: "PAID",
        expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
        totalInCents: 15_000,
        seats: {
          create: {
            seatId: paidSeat.id,
            priceInCents: 15_000,
          },
        },
      },
    });

    const pendingReservation = await prisma.reservation.create({
      data: {
        customerId: customer.id,
        eventId: event.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
        totalInCents: 15_000,
        seats: {
          create: {
            seatId: pendingSeat.id,
            priceInCents: 15_000,
          },
        },
      },
    });

    const ticket = await prisma.ticket.create({
      data: {
        reservationId: paidReservation.id,
        customerId: customer.id,
        eventId: event.id,
        seatId: paidSeat.id,
        code: "cancelled-ticket-code-with-at-least-thirty-two-characters",
      },
    });

    eventId = event.id;
    pendingReservationId = pendingReservation.id;
    ticketCode = ticket.code;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cancels an owned event, expires pending reservations and invalidates tickets", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/events/${eventId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status, response.text).toBe(200);
    expect(response.body).toMatchObject({
      id: eventId,
      status: "CANCELLED",
    });

    const pendingReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: pendingReservationId,
      },
      include: {
        seats: true,
      },
    });

    expect(pendingReservation.status).toBe("EXPIRED");
    expect(pendingReservation.seats).toHaveLength(0);

    const sharedTicketResponse = await request(app).get(
      `/api/tickets/${ticketCode}`,
    );

    expect(sharedTicketResponse.status).toBe(200);
    expect(sharedTicketResponse.body).toMatchObject({
      code: ticketCode,
      status: "CANCELLED",
    });
  });
});
