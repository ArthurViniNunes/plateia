import { prisma } from "../database/prisma.js";
import { TicketNotFoundError } from "./ticket-errors.js";
import { toTicketResponse } from "./ticket-response.js";

export async function getSharedTicket(code: string) {
  const ticket = await prisma.ticket.findUnique({
    where: {
      code,
    },
    include: {
      event: true,
      seat: true,
    },
  });

  if (!ticket) {
    throw new TicketNotFoundError();
  }

  return toTicketResponse(ticket);
}
