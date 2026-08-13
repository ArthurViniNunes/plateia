import { prisma } from "../database/prisma.js";
import { EventNotFoundError } from "./event-errors.js";
import { toEventResponse } from "./event-response.js";

type SeatAvailability = "AVAILABLE" | "BLOCKED" | "SOLD";

export async function getPublicEvent(eventId: string) {
  const now = new Date();

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      status: "PUBLISHED",
      startsAt: {
        gt: now,
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
        include: {
          reservationSeat: {
            select: {
              reservation: {
                select: {
                  status: true,
                  expiresAt: true,
                },
              },
            },
          },
          ticket: {
            select: {
              id: true,
            },
          },
        },
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
      status: SeatAvailability;
    }>
  >();

  for (const seat of event.seats) {
    const seats = rows.get(seat.rowLabel) ?? [];
    const reservation = seat.reservationSeat?.reservation;

    let status: SeatAvailability = "AVAILABLE";

    if (seat.ticket) {
      status = "SOLD";
    } else if (
      reservation?.status === "PENDING" &&
      reservation.expiresAt > now
    ) {
      status = "BLOCKED";
    }

    seats.push({
      id: seat.id,
      number: seat.number,
      status,
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
