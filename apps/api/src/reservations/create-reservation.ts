import { Prisma } from "../generated/prisma/client.js";

import { prisma } from "../database/prisma.js";
import { EventNotFoundError } from "../events/event-errors.js";
import { SeatsUnavailableError } from "./reservation-errors.js";

interface CreateReservationInput {
  customerId: string;
  eventId: string;
  seatIds: string[];
}

interface LockedSeat {
  id: string;
  event_id: string;
  row_label: string;
  number: number;
}

const reservationDurationInMilliseconds = 10 * 60 * 1_000;

export async function createReservation({
  customerId,
  eventId,
  seatIds,
}: CreateReservationInput) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + reservationDurationInMilliseconds);
  const orderedSeatIds = seatIds.toSorted();

  return prisma.$transaction(async (transaction) => {
    const event = await transaction.event.findFirst({
      where: {
        id: eventId,
        status: "PUBLISHED",
        startsAt: {
          gt: now,
        },
      },
    });

    if (!event) {
      throw new EventNotFoundError();
    }

    const lockedSeats = await transaction.$queryRaw<LockedSeat[]>(
      Prisma.sql`
        SELECT id, event_id, row_label, number
        FROM seats
        WHERE id IN (
          ${Prisma.join(
            orderedSeatIds.map((seatId) => Prisma.sql`${seatId}::uuid`),
          )}
        )
        ORDER BY id
        FOR UPDATE
      `,
    );

    if (
      lockedSeats.length !== orderedSeatIds.length ||
      lockedSeats.some((seat) => seat.event_id !== eventId)
    ) {
      throw new SeatsUnavailableError();
    }

    const expiredReservationSeats = await transaction.reservationSeat.findMany({
      where: {
        seatId: {
          in: orderedSeatIds,
        },
        reservation: {
          status: "PENDING",
          expiresAt: {
            lte: now,
          },
        },
      },
      select: {
        reservationId: true,
      },
    });

    const expiredReservationIds = [
      ...new Set(
        expiredReservationSeats.map(({ reservationId }) => reservationId),
      ),
    ];

    if (expiredReservationIds.length > 0) {
      await transaction.reservationSeat.deleteMany({
        where: {
          reservationId: {
            in: expiredReservationIds,
          },
        },
      });

      await transaction.reservation.updateMany({
        where: {
          id: {
            in: expiredReservationIds,
          },
          status: "PENDING",
          expiresAt: {
            lte: now,
          },
        },
        data: {
          status: "EXPIRED",
        },
      });
    }

    const occupiedSeatCount = await transaction.reservationSeat.count({
      where: {
        seatId: {
          in: orderedSeatIds,
        },
      },
    });

    if (occupiedSeatCount > 0) {
      throw new SeatsUnavailableError();
    }

    const reservation = await transaction.reservation.create({
      data: {
        customerId,
        eventId,
        expiresAt,
        totalInCents: event.priceInCents * lockedSeats.length,
        seats: {
          create: lockedSeats.map((seat) => ({
            seatId: seat.id,
            priceInCents: event.priceInCents,
          })),
        },
      },
      include: {
        seats: {
          include: {
            seat: true,
          },
          orderBy: [
            {
              seat: {
                rowLabel: "asc",
              },
            },
            {
              seat: {
                number: "asc",
              },
            },
          ],
        },
      },
    });

    return {
      id: reservation.id,
      eventId: reservation.eventId,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      totalInCents: reservation.totalInCents,
      seats: reservation.seats.map(({ seat, priceInCents }) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        number: seat.number,
        priceInCents,
      })),
    };
  });
}
