import type { EventStatus } from "../generated/prisma/client.js";

interface EventResponseSource {
  id: string;
  ticketmasterId: string;
  title: string;
  imageUrl: string | null;
  classification: string | null;
  externalUrl: string | null;
  startsAt: Date;
  venueName: string;
  address: string;
  city: string;
  state: string;
  priceInCents: number;
  status: EventStatus;
  _count: {
    seats: number;
  };
}

export function toEventResponse(event: EventResponseSource) {
  return {
    id: event.id,
    ticketmasterId: event.ticketmasterId,
    title: event.title,
    imageUrl: event.imageUrl,
    classification: event.classification,
    externalUrl: event.externalUrl,
    startsAt: event.startsAt.toISOString(),
    venue: {
      name: event.venueName,
      address: event.address,
      city: event.city,
      state: event.state,
    },
    priceInCents: event.priceInCents,
    status: event.status,
    capacity: event._count.seats,
  };
}
