import { Router } from "express";

import { createAuthenticationMiddleware } from "../auth/authentication-middleware.js";
import { requireRoles } from "../auth/authorization-middleware.js";
import {
  TicketmasterUnavailableError,
  type CatalogClient,
} from "./ticketmaster-client.js";
import { catalogQuerySchema } from "./catalog-query-schema.js";

interface CreateCatalogRouterOptions {
  catalogClient: CatalogClient;
  jwtSecret: string;
}

export function createCatalogRouter({
  catalogClient,
  jwtSecret,
}: CreateCatalogRouterOptions) {
  const catalogRouter = Router();
  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  catalogRouter.get(
    "/events",
    authenticationMiddleware,
    requireRoles("ORGANIZER"),
    async (request, response) => {
      const result = catalogQuerySchema.safeParse(request.query);

      if (!result.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
          },
        });
        return;
      }

      try {
        const events = await catalogClient.searchEvents(result.data.query);

        response.status(200).json({
          events,
        });
      } catch (error: unknown) {
        if (error instanceof TicketmasterUnavailableError) {
          response.status(503).json({
            error: {
              code: "TICKETMASTER_UNAVAILABLE",
              message: "Ticketmaster catalog is unavailable",
            },
          });
          return;
        }

        throw error;
      }
    },
  );

  return catalogRouter;
}
