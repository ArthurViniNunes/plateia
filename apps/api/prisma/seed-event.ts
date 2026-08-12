import type { PrismaClient } from "../src/generated/prisma/client.js";

const demonstrationEvent = {
  ticketmasterId: "demo-corujao-plateia-noite-de-codigo",
  title: "Corujão Plateia - Noite de Código",
  classification: "Evento de demonstração",
  startsAt: new Date("2099-08-20T23:00:00.000Z"),
  venueName: "Teatro Plateia",
  address: "Rua da Cultura, 100",
  city: "Fortaleza",
  state: "CE",
  priceInCents: 15_000,
} as const;

const demonstrationSeats = ["A", "B", "C"].flatMap((rowLabel) =>
  Array.from({ length: 8 }, (_, index) => ({
    rowLabel,
    number: index + 1,
  })),
);

export async function seedEvent(database: PrismaClient): Promise<void> {
  const organizer = await database.user.findUnique({
    where: {
      email: "organizer@plateia.local",
    },
    select: {
      id: true,
    },
  });

  if (!organizer) {
    throw new Error("Demonstration organizer must be seeded before the event");
  }

  await database.$transaction(async (transaction) => {
    const existingEvent = await transaction.event.findFirst({
      where: {
        ticketmasterId: demonstrationEvent.ticketmasterId,
      },
      select: {
        id: true,
      },
    });

    const event = existingEvent
      ? await transaction.event.update({
          where: {
            id: existingEvent.id,
          },
          data: {
            organizerId: organizer.id,
            title: demonstrationEvent.title,
            imageUrl: null,
            classification: demonstrationEvent.classification,
            externalUrl: null,
            startsAt: demonstrationEvent.startsAt,
            venueName: demonstrationEvent.venueName,
            address: demonstrationEvent.address,
            city: demonstrationEvent.city,
            state: demonstrationEvent.state,
            priceInCents: demonstrationEvent.priceInCents,
            status: "PUBLISHED",
          },
        })
      : await transaction.event.create({
          data: {
            organizerId: organizer.id,
            ticketmasterId: demonstrationEvent.ticketmasterId,
            title: demonstrationEvent.title,
            imageUrl: null,
            classification: demonstrationEvent.classification,
            externalUrl: null,
            catalogFetchedAt: new Date(),
            startsAt: demonstrationEvent.startsAt,
            venueName: demonstrationEvent.venueName,
            address: demonstrationEvent.address,
            city: demonstrationEvent.city,
            state: demonstrationEvent.state,
            priceInCents: demonstrationEvent.priceInCents,
            status: "PUBLISHED",
          },
        });

    await transaction.seat.createMany({
      data: demonstrationSeats.map(({ rowLabel, number }) => ({
        eventId: event.id,
        rowLabel,
        number,
      })),
      skipDuplicates: true,
    });
  });
}
