import { prisma } from "../database/prisma.js";
import { EventNotFoundError } from "./event-errors.js";
import { toEventResponse } from "./event-response.js";

export async function getPublicEvent(eventId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      status: "PUBLISHED",
      startsAt: {
        gt: new Date(),
      },
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

  const rows = new Map<
    string,
    Array<{
      id: string;
      number: number;
      status: "AVAILABLE";
    }>
  >();

  for (const seat of event.seats) {
    const seats = rows.get(seat.rowLabel) ?? [];

    seats.push({
      id: seat.id,
      number: seat.number,
      status: "AVAILABLE",
    });

    rows.set(seat.rowLabel, seats);
  }

  return {
    ...toEventResponse(event),
    rows: Array.from(rows, ([label, seats]) => ({
      label,
      seats,
    })),
  };
}
