import type { CatalogClient } from "../catalog/ticketmaster-client.js";
import { prisma } from "../database/prisma.js";
import type { CreateEventInput } from "./create-event-schema.js";
import { toEventResponse } from "./event-response.js";

interface CreateDraftEventOptions {
  organizerId: string;
  input: CreateEventInput;
  catalogClient: CatalogClient;
}

export async function createDraftEvent({
  organizerId,
  input,
  catalogClient,
}: CreateDraftEventOptions) {
  const catalogEvent = await catalogClient.getEventById(input.ticketmasterId);

  const seats = input.rows.flatMap((row) =>
    Array.from(
      {
        length: row.seatCount,
      },
      (_, index) => ({
        rowLabel: row.label,
        number: index + 1,
      }),
    ),
  );

  const catalogFetchedAt = new Date();

  const event = await prisma.$transaction((transaction) =>
    transaction.event.create({
      data: {
        organizerId,
        ticketmasterId: catalogEvent.id,
        title: catalogEvent.title,
        imageUrl: catalogEvent.imageUrl,
        classification: catalogEvent.classification,
        externalUrl: catalogEvent.externalUrl,
        catalogFetchedAt,
        startsAt: input.startsAt,
        venueName: input.venue.name,
        address: input.venue.address,
        city: input.venue.city,
        state: input.venue.state,
        priceInCents: input.priceInCents,
        seats: {
          create: seats,
        },
      },
      include: {
        _count: {
          select: {
            seats: true,
          },
        },
      },
    }),
  );

  return toEventResponse(event);
}
