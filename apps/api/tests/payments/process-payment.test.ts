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
  throw new Error("JWT_SECRET is required for payment tests");
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

const paymentResponseSchema = z.object({
  id: z.uuid(),
  status: z.literal("PAID"),
  totalInCents: z.number().int().positive(),
  tickets: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().min(32),
      eventId: z.uuid(),
      seat: z.object({
        id: z.uuid(),
        rowLabel: z.string(),
        number: z.number().int().positive(),
      }),
    }),
  ),
});

let reservationId: string;
let eventId: string;

describe("POST /api/reservations/:reservationId/payment", () => {
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
        ticketmasterId: "ticketmaster-payment-event",
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
        seats: true,
      },
    });

    const reservation = await prisma.reservation.create({
      data: {
        customerId: customer.id,
        eventId: event.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
        totalInCents: 30_000,
        seats: {
          create: event.seats.map(({ id }) => ({
            seatId: id,
            priceInCents: 15_000,
          })),
        },
      },
    });

    eventId = event.id;
    reservationId = reservation.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("approves the payment and issues one ticket per seat", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/reservations/${reservationId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        outcome: "APPROVED",
      });

    expect(response.status, response.text).toBe(200);

    const body = paymentResponseSchema.parse(response.body);

    expect(body.id).toBe(reservationId);
    expect(body.totalInCents).toBe(30_000);
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets.every((ticket) => ticket.eventId === eventId)).toBe(
      true,
    );

    expect(
      body.tickets.map(({ seat }) => ({
        rowLabel: seat.rowLabel,
        number: seat.number,
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
    ]);

    expect(new Set(body.tickets.map(({ code }) => code)).size).toBe(2);

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: reservationId,
      },
    });

    expect(storedReservation.status).toBe("PAID");
  });

  it("declines the payment and releases the seats", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/reservations/${reservationId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        outcome: "DECLINED",
      });

    expect(response.status, response.text).toBe(200);
    expect(response.body).toEqual({
      id: reservationId,
      status: "REJECTED",
      totalInCents: 30_000,
      tickets: [],
    });

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: reservationId,
      },
      include: {
        seats: true,
        tickets: true,
      },
    });

    expect(storedReservation.status).toBe("REJECTED");
    expect(storedReservation.seats).toHaveLength(0);
    expect(storedReservation.tickets).toHaveLength(0);
  });

  it("expires an overdue reservation and releases the seats", async () => {
    await prisma.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/reservations/${reservationId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        outcome: "APPROVED",
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "RESERVATION_EXPIRED",
        message: "Reservation has expired",
      },
    });

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: reservationId,
      },
      include: {
        seats: true,
        tickets: true,
      },
    });

    expect(storedReservation.status).toBe("EXPIRED");
    expect(storedReservation.seats).toHaveLength(0);
    expect(storedReservation.tickets).toHaveLength(0);
  });

  it("hides a reservation owned by another customer", async () => {
    await prisma.user.create({
      data: {
        name: "Outro Cliente",
        email: "other-customer@plateia.local",
        passwordHash: await hash("Plateia123!", 12),
        role: "CUSTOMER",
      },
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "other-customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .post(`/api/reservations/${reservationId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        outcome: "APPROVED",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "RESERVATION_NOT_FOUND",
        message: "Reservation not found",
      },
    });

    expect(await prisma.ticket.count()).toBe(0);
  });

  it("allows only one concurrent payment for a reservation", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "customer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const payReservation = () =>
      request(app)
        .post(`/api/reservations/${reservationId}/payment`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          outcome: "APPROVED",
        });

    const responses = await Promise.all([payReservation(), payReservation()]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([
      200, 409,
    ]);

    const conflictResponse = responses.find(({ status }) => status === 409);

    expect(conflictResponse?.body).toEqual({
      error: {
        code: "RESERVATION_CANNOT_BE_PAID",
        message: "Reservation cannot be paid",
      },
    });

    expect(await prisma.ticket.count()).toBe(2);

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: reservationId,
      },
    });

    expect(storedReservation.status).toBe("PAID");
  });
});
