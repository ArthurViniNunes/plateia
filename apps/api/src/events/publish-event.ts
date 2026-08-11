import { prisma } from "../database/prisma.js";
import {
  EventCannotBePublishedError,
  EventNotFoundError,
} from "./event-errors.js";
import { toEventResponse } from "./event-response.js";

interface PublishEventOptions {
  eventId: string;
  organizerId: string;
  now?: Date;
}

export async function publishEvent({
  eventId,
  organizerId,
  now = new Date(),
}: PublishEventOptions) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizerId,
    },
    include: {
      _count: {
        select: {
          seats: true,
        },
      },
    },
  });

  if (!event) {
    throw new EventNotFoundError();
  }

  if (
    event.status !== "DRAFT" ||
    event.startsAt <= now ||
    event.priceInCents <= 0 ||
    event._count.seats === 0
  ) {
    throw new EventCannotBePublishedError();
  }

  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      organizerId,
      status: "DRAFT",
      startsAt: {
        gt: now,
      },
      priceInCents: {
        gt: 0,
      },
    },
    data: {
      status: "PUBLISHED",
    },
  });

  if (result.count !== 1) {
    throw new EventCannotBePublishedError();
  }

  const publishedEvent = await prisma.event.findUniqueOrThrow({
    where: {
      id: eventId,
    },
    include: {
      _count: {
        select: {
          seats: true,
        },
      },
    },
  });

  return toEventResponse(publishedEvent);
}
