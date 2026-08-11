import { Router } from "express";
import { z } from "zod";

import {
  EventCannotBePublishedError,
  EventNotFoundError,
} from "./event-errors.js";
import { publishEvent } from "./publish-event.js";

import { createAuthenticationMiddleware } from "../auth/authentication-middleware.js";
import { requireRoles } from "../auth/authorization-middleware.js";
import {
  CatalogEventNotFoundError,
  TicketmasterUnavailableError,
  type CatalogClient,
} from "../catalog/ticketmaster-client.js";
import { createDraftEvent } from "./create-draft-event.js";
import { createEventSchema } from "./create-event-schema.js";
import { listEventsQuerySchema } from "./list-events-query-schema.js";
import { listPublicEvents } from "./list-public-events.js";
import { getPublicEvent } from "./get-public-event.js";

interface CreateEventsRouterOptions {
  catalogClient: CatalogClient;
  jwtSecret: string;
}

export function createEventsRouter({
  catalogClient,
  jwtSecret,
}: CreateEventsRouterOptions) {
  const eventsRouter = Router();
  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  eventsRouter.get("/", async (request, response) => {
    const result = listEventsQuerySchema.safeParse(request.query);

    if (!result.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
        },
      });
      return;
    }

    const events = await listPublicEvents(result.data);

    response.status(200).json(events);
  });

  eventsRouter.get("/:eventId", async (request, response) => {
    const eventIdResult = z.uuid().safeParse(request.params.eventId);

    if (!eventIdResult.success) {
      response.status(404).json({
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found",
        },
      });
      return;
    }

    try {
      const event = await getPublicEvent(eventIdResult.data);

      response.status(200).json(event);
    } catch (error: unknown) {
      if (error instanceof EventNotFoundError) {
        response.status(404).json({
          error: {
            code: "EVENT_NOT_FOUND",
            message: "Event not found",
          },
        });
        return;
      }

      throw error;
    }
  });

  eventsRouter.post(
    "/",
    authenticationMiddleware,
    requireRoles("ORGANIZER"),
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

      const result = createEventSchema.safeParse(request.body);

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
        const event = await createDraftEvent({
          organizerId: user.id,
          input: result.data,
          catalogClient,
        });

        response.status(201).json(event);
      } catch (error: unknown) {
        if (error instanceof CatalogEventNotFoundError) {
          response.status(404).json({
            error: {
              code: "CATALOG_EVENT_NOT_FOUND",
              message: "Catalog event not found",
            },
          });
          return;
        }

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

  eventsRouter.post(
    "/:eventId/publish",
    authenticationMiddleware,
    requireRoles("ORGANIZER"),
    async (request, response) => {
      const user = request.authenticatedUser;
      const eventIdResult = z.uuid().safeParse(request.params.eventId);

      if (!user) {
        response.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
        return;
      }

      if (!eventIdResult.success) {
        response.status(404).json({
          error: {
            code: "EVENT_NOT_FOUND",
            message: "Event not found",
          },
        });
        return;
      }

      try {
        const event = await publishEvent({
          eventId: eventIdResult.data,
          organizerId: user.id,
        });

        response.status(200).json(event);
      } catch (error: unknown) {
        if (error instanceof EventNotFoundError) {
          response.status(404).json({
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found",
            },
          });
          return;
        }

        if (error instanceof EventCannotBePublishedError) {
          response.status(409).json({
            error: {
              code: "EVENT_CANNOT_BE_PUBLISHED",
              message: "Event cannot be published",
            },
          });
          return;
        }

        throw error;
      }
    },
  );

  return eventsRouter;
}
