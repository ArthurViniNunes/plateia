import { prisma } from "../database/prisma.js";
import {
  EventCannotBeCancelledError,
  EventNotFoundError,
} from "./event-errors.js";
import { toEventResponse } from "./event-response.js";

interface CancelEventInput {
  eventId: string;
  organizerId: string;
}

export async function cancelEvent({ eventId, organizerId }: CancelEventInput) {
  return prisma.$transaction(async (transaction) => {
    const event = await transaction.event.findFirst({
      where: {
        id: eventId,
        organizerId,
      },
      select: {
        status: true,
      },
    });

    if (!event) {
      throw new EventNotFoundError();
    }

    if (event.status === "CANCELLED") {
      throw new EventCannotBeCancelledError();
    }

    const cancellation = await transaction.event.updateMany({
      where: {
        id: eventId,
        organizerId,
        status: {
          in: ["DRAFT", "PUBLISHED"],
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    if (cancellation.count !== 1) {
      throw new EventCannotBeCancelledError();
    }

    await transaction.reservationSeat.deleteMany({
      where: {
        reservation: {
          eventId,
          status: "PENDING",
        },
      },
    });

    await transaction.reservation.updateMany({
      where: {
        eventId,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
    });

    const cancelledEvent = await transaction.event.findUniqueOrThrow({
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

    return toEventResponse(cancelledEvent);
  });
}
