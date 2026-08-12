import type { EventStatus } from "../generated/prisma/client.js";

interface TicketResponseSource {
  id: string;
  code: string;
  usedAt: Date | null;
  event: {
    id: string;
    title: string;
    startsAt: Date;
    venueName: string;
    city: string;
    state: string;
    status: EventStatus;
  };
  seat: {
    id: string;
    rowLabel: string;
    number: number;
  };
}

function getTicketStatus({
  usedAt,
  event,
}: TicketResponseSource): "VALID" | "USED" | "CANCELLED" {
  if (event.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (usedAt) {
    return "USED";
  }

  return "VALID";
}

export function toTicketResponse(ticket: TicketResponseSource) {
  return {
    id: ticket.id,
    code: ticket.code,
    status: getTicketStatus(ticket),
    event: {
      id: ticket.event.id,
      title: ticket.event.title,
      startsAt: ticket.event.startsAt.toISOString(),
      venue: {
        name: ticket.event.venueName,
        city: ticket.event.city,
        state: ticket.event.state,
      },
    },
    seat: {
      id: ticket.seat.id,
      rowLabel: ticket.seat.rowLabel,
      number: ticket.seat.number,
    },
    sharePath: `/tickets/${ticket.code}`,
  };
}
