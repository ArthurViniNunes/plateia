import cors from "cors";
import express from "express";
import { createAuthRouter } from "./auth/auth-router.js";
import {
  createTicketmasterClient,
  type CatalogClient,
} from "./catalog/ticketmaster-client.js";
import { createCatalogRouter } from "./catalog/catalog-router.js";
import { createEventsRouter } from "./events/events-router.js";
import { createPaymentsRouter } from "./payments/payments-router.js";
import { createTicketsRouter } from "./tickets/tickets-router.js";
import { createGateRouter } from "./gate/gate-router.js";

interface CreateAppOptions {
  corsOrigin: string;
  jwtSecret: string;
  catalogClient?: CatalogClient;
}

export function createApp({
  corsOrigin,
  jwtSecret,
  catalogClient = createTicketmasterClient({}),
}: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");

  app.use(express.json());

  app.use(
    cors({
      origin(requestOrigin, callback) {
        if (!requestOrigin || requestOrigin === corsOrigin) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );

  app.use(
    "/api/auth",
    createAuthRouter({
      jwtSecret,
    }),
  );

  app.use(
    "/api/catalog",
    createCatalogRouter({
      catalogClient,
      jwtSecret,
    }),
  );

  app.use(
    "/api/events",
    createEventsRouter({
      catalogClient,
      jwtSecret,
    }),
  );

  app.use(
    "/api/reservations",
    createPaymentsRouter({
      jwtSecret,
    }),
  );

  app.use(
    "/api/tickets",
    createTicketsRouter({
      jwtSecret,
    }),
  );

  app.use(
    "/api/gate",
    createGateRouter({
      jwtSecret,
    }),
  );

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
    });
  });

  return app;
}
