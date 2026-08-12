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
  throw new Error("JWT_SECRET is required for managed event tests");
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

const responseSchema = z.object({
  events: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]),
      capacity: z.number().int(),
    }),
  ),
});

function eventData(
  organizerId: string,
  title: string,
  status: "DRAFT" | "PUBLISHED" | "CANCELLED",
) {
  return {
    organizerId,
    ticketmasterId: `ticketmaster-${title}`,
    title,
    catalogFetchedAt: new Date(),
    startsAt: new Date("2099-08-20T23:00:00.000Z"),
    venueName: "Teatro Plateia",
    address: "Rua da Cultura, 100",
    city: "Fortaleza",
    state: "CE",
    priceInCents: 15_000,
    status,
    seats: {
      create: {
        rowLabel: "A",
        number: 1,
      },
    },
  };
}

describe("GET /api/events/mine", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists every event owned by the authenticated organizer", async () => {
    const passwordHash = await hash("Plateia123!", 12);

    const [organizer, otherOrganizer] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Organizador Plateia",
          email: "organizer@plateia.local",
          passwordHash,
          role: "ORGANIZER",
        },
      }),
      prisma.user.create({
        data: {
          name: "Outro Organizador",
          email: "other-organizer@plateia.local",
          passwordHash,
          role: "ORGANIZER",
        },
      }),
    ]);

    await Promise.all([
      prisma.event.create({
        data: eventData(organizer.id, "Evento em rascunho", "DRAFT"),
      }),
      prisma.event.create({
        data: eventData(organizer.id, "Evento publicado", "PUBLISHED"),
      }),
      prisma.event.create({
        data: eventData(organizer.id, "Evento cancelado", "CANCELLED"),
      }),
      prisma.event.create({
        data: eventData(
          otherOrganizer.id,
          "Evento de outro organizador",
          "PUBLISHED",
        ),
      }),
    ]);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "organizer@plateia.local",
      password: "Plateia123!",
    });

    const { token } = loginResponseSchema.parse(loginResponse.body);

    const response = await request(app)
      .get("/api/events/mine")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status, response.text).toBe(200);

    const body = responseSchema.parse(response.body);

    expect(
      body.events
        .map(({ title, status, capacity }) => ({
          title,
          status,
          capacity,
        }))
        .toSorted((first, second) => first.title.localeCompare(second.title)),
    ).toEqual([
      {
        title: "Evento cancelado",
        status: "CANCELLED",
        capacity: 1,
      },
      {
        title: "Evento em rascunho",
        status: "DRAFT",
        capacity: 1,
      },
      {
        title: "Evento publicado",
        status: "PUBLISHED",
        capacity: 1,
      },
    ]);
  });
});
