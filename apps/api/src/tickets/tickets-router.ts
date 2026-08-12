import { Router } from "express";
import { z } from "zod";

import { createAuthenticationMiddleware } from "../auth/authentication-middleware.js";
import { requireRoles } from "../auth/authorization-middleware.js";
import { getSharedTicket } from "./get-shared-ticket.js";
import { listCustomerTickets } from "./list-customer-tickets.js";
import { TicketNotFoundError } from "./ticket-errors.js";

interface CreateTicketsRouterOptions {
  jwtSecret: string;
}

const ticketCodeSchema = z.string().min(1).max(200);

export function createTicketsRouter({ jwtSecret }: CreateTicketsRouterOptions) {
  const ticketsRouter = Router();
  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  ticketsRouter.get(
    "/",
    authenticationMiddleware,
    requireRoles("CUSTOMER"),
    async (request, response) => {
      const user = request.authenticatedUser;

      if (!user) {
        response.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
        return;
      }

      const tickets = await listCustomerTickets(user.id);

      response.status(200).json(tickets);
    },
  );

  ticketsRouter.get("/:code", async (request, response) => {
    const codeResult = ticketCodeSchema.safeParse(request.params.code);

    if (!codeResult.success) {
      response.status(404).json({
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket not found",
        },
      });
      return;
    }

    try {
      const ticket = await getSharedTicket(codeResult.data);

      response.status(200).json(ticket);
    } catch (error: unknown) {
      if (error instanceof TicketNotFoundError) {
        response.status(404).json({
          error: {
            code: "TICKET_NOT_FOUND",
            message: "Ticket not found",
          },
        });
        return;
      }

      throw error;
    }
  });

  return ticketsRouter;
}
