import { randomBytes } from "node:crypto";

import { Prisma } from "../generated/prisma/client.js";

import { prisma } from "../database/prisma.js";
import {
  ReservationCannotBePaidError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from "./payment-errors.js";

interface ProcessPaymentInput {
  reservationId: string;
  customerId: string;
  outcome: "APPROVED" | "DECLINED";
}

interface LockedReservation {
  id: string;
}

export async function processPayment({
  reservationId,
  customerId,
  outcome,
}: ProcessPaymentInput) {
  const result = await prisma.$transaction(async (transaction) => {
    const lockedReservations = await transaction.$queryRaw<LockedReservation[]>(
      Prisma.sql`
          SELECT id
          FROM reservations
          WHERE id = ${reservationId}::uuid
            AND customer_id = ${customerId}::uuid
          FOR UPDATE
        `,
    );

    if (lockedReservations.length === 0) {
      return {
        kind: "NOT_FOUND" as const,
      };
    }

    const reservation = await transaction.reservation.findUniqueOrThrow({
      where: {
        id: reservationId,
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

    if (reservation.status !== "PENDING") {
      return {
        kind: "CANNOT_BE_PAID" as const,
      };
    }

    if (reservation.expiresAt <= new Date()) {
      await transaction.reservationSeat.deleteMany({
        where: {
          reservationId,
        },
      });

      await transaction.reservation.update({
        where: {
          id: reservationId,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return {
        kind: "EXPIRED" as const,
      };
    }

    if (outcome === "DECLINED") {
      await transaction.reservationSeat.deleteMany({
        where: {
          reservationId,
        },
      });

      const rejectedReservation = await transaction.reservation.update({
        where: {
          id: reservationId,
        },
        data: {
          status: "REJECTED",
        },
      });

      return {
        kind: "SUCCESS" as const,
        response: {
          id: rejectedReservation.id,
          status: rejectedReservation.status,
          totalInCents: rejectedReservation.totalInCents,
          tickets: [],
        },
      };
    }

    const tickets = [];

    for (const reservationSeat of reservation.seats) {
      const ticket = await transaction.ticket.create({
        data: {
          reservationId: reservation.id,
          customerId: reservation.customerId,
          eventId: reservation.eventId,
          seatId: reservationSeat.seatId,
          code: randomBytes(32).toString("base64url"),
        },
      });

      tickets.push({
        id: ticket.id,
        code: ticket.code,
        eventId: ticket.eventId,
        seat: {
          id: reservationSeat.seat.id,
          rowLabel: reservationSeat.seat.rowLabel,
          number: reservationSeat.seat.number,
        },
      });
    }

    const paidReservation = await transaction.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "PAID",
      },
    });

    return {
      kind: "SUCCESS" as const,
      response: {
        id: paidReservation.id,
        status: paidReservation.status,
        totalInCents: paidReservation.totalInCents,
        tickets,
      },
    };
  });

  if (result.kind === "NOT_FOUND") {
    throw new ReservationNotFoundError();
  }

  if (result.kind === "EXPIRED") {
    throw new ReservationExpiredError();
  }

  if (result.kind === "CANNOT_BE_PAID") {
    throw new ReservationCannotBePaidError();
  }

  return result.response;
}
