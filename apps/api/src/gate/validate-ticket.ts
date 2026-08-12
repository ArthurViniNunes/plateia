import { Prisma } from "../generated/prisma/client.js";

import { prisma } from "../database/prisma.js";

interface ValidateTicketInput {
  eventId: string;
  code: string;
}

interface LockedTicket {
  id: string;
  eventId: string;
  eventStatus: "DRAFT" | "PUBLISHED" | "CANCELLED";
  startsAt: Date;
  usedAt: Date | null;
  rowLabel: string;
  seatNumber: number;
}

const validationWindowInMilliseconds = 6 * 60 * 60 * 1_000;

export async function validateTicket({ eventId, code }: ValidateTicketInput) {
  return prisma.$transaction(async (transaction) => {
    const lockedTickets = await transaction.$queryRaw<LockedTicket[]>(
      Prisma.sql`
    SELECT
      tickets.id,
      tickets.event_id AS "eventId",
      events.status AS "eventStatus",
      events.starts_at AS "startsAt",
      tickets.used_at AS "usedAt",
      seats.row_label AS "rowLabel",
      seats.number AS "seatNumber"
    FROM tickets
    INNER JOIN events ON events.id = tickets.event_id
    INNER JOIN seats ON seats.id = tickets.seat_id
    WHERE tickets.code = ${code}
    FOR UPDATE OF tickets
  `,
    );

    if (lockedTickets.length === 0) {
      return {
        result: "INVALID" as const,
      };
    }

    const ticket = lockedTickets[0];

    if (!ticket) {
      return {
        result: "INVALID" as const,
      };
    }

    if (ticket.eventId !== eventId) {
      return {
        result: "WRONG_EVENT" as const,
      };
    }

    if (ticket.eventId !== eventId) {
      return {
        result: "WRONG_EVENT" as const,
      };
    }

    const now = new Date();
    const validationEndsAt =
      ticket.startsAt.getTime() + validationWindowInMilliseconds;

    if (
      ticket.eventStatus === "CANCELLED" ||
      now.getTime() > validationEndsAt
    ) {
      return {
        result: "INVALID" as const,
      };
    }

    if (ticket.usedAt) {
      return {
        result: "ALREADY_USED" as const,
      };
    }

    const validatedTicket = await transaction.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        usedAt: now,
      },
    });

    return {
      result: "VALID" as const,
      validatedAt: now.toISOString(),
      ticket: {
        id: validatedTicket.id,
        eventId: validatedTicket.eventId,
        seat: {
          rowLabel: ticket.rowLabel,
          number: ticket.seatNumber,
        },
      },
    };
  });
}
