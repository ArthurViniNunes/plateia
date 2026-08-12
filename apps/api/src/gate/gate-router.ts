import { Router } from "express";

import { createAuthenticationMiddleware } from "../auth/authentication-middleware.js";
import { requireRoles } from "../auth/authorization-middleware.js";
import { validateTicket } from "./validate-ticket.js";
import { validateTicketSchema } from "./validate-ticket-schema.js";

interface CreateGateRouterOptions {
  jwtSecret: string;
}

export function createGateRouter({ jwtSecret }: CreateGateRouterOptions) {
  const gateRouter = Router();
  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  gateRouter.post(
    "/validate",
    authenticationMiddleware,
    requireRoles("GATEKEEPER"),
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

      const result = validateTicketSchema.safeParse(request.body);

      if (!result.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
          },
        });
        return;
      }

      const validation = await validateTicket(result.data);

      response.status(200).json(validation);
    },
  );

  return gateRouter;
}
