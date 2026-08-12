import { prisma } from "../database/prisma.js";
import { toTicketResponse } from "./ticket-response.js";

export async function listCustomerTickets(customerId: string) {
  const tickets = await prisma.ticket.findMany({
    where: {
      customerId,
    },
    include: {
      event: true,
      seat: true,
    },
    orderBy: [
      {
        event: {
          startsAt: "asc",
        },
      },
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
  });

  return {
    tickets: tickets.map(toTicketResponse),
  };
}
