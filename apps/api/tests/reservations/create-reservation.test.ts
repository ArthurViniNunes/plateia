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
  throw new Error("JWT_SECRET is required for reservation tests");
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

const reservationResponseSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  status: z.literal("PENDING"),
  expiresAt: z.iso.datetime(),
  totalInCents: z.number().int().positive(),
  seats: z.array(
    z.object({
      id: z.uuid(),
      rowLabel: z.string(),
      number: z.number().int().positive(),
      priceInCents: z.number().int().positive(),
    }),
  ),
});

let eventId: string;
let selectedSeatIds: string[];

function getSelectedSeatId() {
  return z.uuid().parse(selectedSeatIds[0]);
}

async function loginAsCustomer() {
  const response = await request(app).post("/api/auth/login").send({
    email: "customer@plateia.local",
    password: "Plateia123!",
  });

  expect(response.status, response.text).toBe(200);

  return loginResponseSchema.parse(response.body).token;
}

describe("POST /api/events/:eventId/reservations", () => {
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
        ticketmasterId: "ticketmaster-reservation-event",
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
              rowLabel: "B",
              number: 2,
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

    eventId = event.id;
    selectedSeatIds = event.seats.map(({ id }) => id);

    expect(customer.role).toBe("CUSTOMER");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks up to four seats for ten minutes", async () => {
    const token = await loginAsCustomer();
    const beforeRequest = Date.now();

    const response = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds: selectedSeatIds,
      });

    const afterRequest = Date.now();

    expect(response.status, response.text).toBe(201);

    const body = reservationResponseSchema.parse(response.body);
    const expiresAt = new Date(body.expiresAt).getTime();

    expect(body.eventId).toBe(eventId);
    expect(body.totalInCents).toBe(30_000);
    expect(
      body.seats.map(({ rowLabel, number }) => ({
        rowLabel,
        number,
      })),
    ).toEqual([
      {
        rowLabel: "A",
        number: 1,
      },
      {
        rowLabel: "B",
        number: 2,
      },
    ]);

    expect(expiresAt).toBeGreaterThanOrEqual(beforeRequest + 10 * 60 * 1_000);
    expect(expiresAt).toBeLessThanOrEqual(afterRequest + 10 * 60 * 1_000);
  });

  it.each([
    ["an empty selection", []],
    [
      "more than four seats",
      Array.from({ length: 5 }, () => crypto.randomUUID()),
    ],
  ])("rejects %s", async (_description, seatIds) => {
    const token = await loginAsCustomer();

    const response = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });

    expect(await prisma.reservation.count()).toBe(0);
  });

  it("rejects duplicated seat identifiers", async () => {
    const token = await loginAsCustomer();
    const seatId = getSelectedSeatId();

    const response = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds: [seatId, seatId],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
      },
    });

    expect(await prisma.reservation.count()).toBe(0);
  });

  it("rejects a seat that is already blocked", async () => {
    const token = await loginAsCustomer();
    const seatId = getSelectedSeatId();

    const firstResponse = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds: [seatId],
      });

    expect(firstResponse.status, firstResponse.text).toBe(201);

    const secondResponse = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds: [seatId],
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body).toEqual({
      error: {
        code: "SEATS_UNAVAILABLE",
        message: "Selected seats are unavailable",
      },
    });
  });

  it("allows only one concurrent reservation for the same seat", async () => {
    const token = await loginAsCustomer();
    const seatId = getSelectedSeatId();

    const reserveSeat = () =>
      request(app)
        .post(`/api/events/${eventId}/reservations`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          seatIds: [seatId],
        });

    const responses = await Promise.all([reserveSeat(), reserveSeat()]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([
      201, 409,
    ]);

    expect(await prisma.reservation.count()).toBe(1);
    expect(await prisma.reservationSeat.count()).toBe(1);
  });

  it("expires an old reservation and releases its seat", async () => {
    const token = await loginAsCustomer();
    const seatId = getSelectedSeatId();

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: "customer@plateia.local",
      },
    });

    const expiredReservation = await prisma.reservation.create({
      data: {
        customerId: customer.id,
        eventId,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 60_000),
        totalInCents: 15_000,
        seats: {
          create: {
            seatId,
            priceInCents: 15_000,
          },
        },
      },
    });

    const response = await request(app)
      .post(`/api/events/${eventId}/reservations`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatIds: [seatId],
      });

    expect(response.status, response.text).toBe(201);

    const previousReservation = await prisma.reservation.findUniqueOrThrow({
      where: {
        id: expiredReservation.id,
      },
      include: {
        seats: true,
      },
    });

    expect(previousReservation.status).toBe("EXPIRED");
    expect(previousReservation.seats).toHaveLength(0);

    expect(await prisma.reservation.count()).toBe(2);
    expect(await prisma.reservationSeat.count()).toBe(1);
  });
});
