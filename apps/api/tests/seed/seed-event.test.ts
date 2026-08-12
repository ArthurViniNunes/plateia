import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { seedEvent } from "../../prisma/seed-event.js";
import { seedUsers } from "../../prisma/seed-users.js";
import { prisma } from "../../src/database/prisma.js";
import { resetDatabase } from "../helpers/reset-database.js";

describe("seedEvent", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a published demonstration event idempotently", async () => {
    await seedUsers(prisma);
    await seedEvent(prisma);
    await seedEvent(prisma);

    const events = await prisma.event.findMany({
      where: {
        ticketmasterId: "demo-corujao-plateia-noite-de-codigo",
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
        reservations: true,
        tickets: true,
      },
    });

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event).toBeDefined();

    if (!event) {
      throw new Error("Demonstration event was not created");
    }

    expect(event).toMatchObject({
      title: "Corujão Plateia - Noite de Código",
      imageUrl: null,
      classification: "Evento de demonstração",
      externalUrl: null,
      startsAt: new Date("2099-08-20T23:00:00.000Z"),
      venueName: "Teatro Plateia",
      address: "Rua da Cultura, 100",
      city: "Fortaleza",
      state: "CE",
      priceInCents: 15_000,
      status: "PUBLISHED",
    });

    expect(event.seats).toHaveLength(24);

    expect(
      event.seats.map(({ rowLabel, number }) => ({
        rowLabel,
        number,
      })),
    ).toEqual([
      ...Array.from({ length: 8 }, (_, index) => ({
        rowLabel: "A",
        number: index + 1,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        rowLabel: "B",
        number: index + 1,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        rowLabel: "C",
        number: index + 1,
      })),
    ]);

    expect(event.reservations).toHaveLength(0);
    expect(event.tickets).toHaveLength(0);
  });
});
