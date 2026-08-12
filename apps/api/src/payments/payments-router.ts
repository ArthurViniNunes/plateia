import { Router } from "express";
import { z } from "zod";

import { createAuthenticationMiddleware } from "../auth/authentication-middleware.js";
import { requireRoles } from "../auth/authorization-middleware.js";
import {
  ReservationCannotBePaidError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from "./payment-errors.js";
import { processPayment } from "./process-payment.js";
import { processPaymentSchema } from "./process-payment-schema.js";

interface CreatePaymentsRouterOptions {
  jwtSecret: string;
}

export function createPaymentsRouter({
  jwtSecret,
}: CreatePaymentsRouterOptions) {
  const paymentsRouter = Router();
  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  paymentsRouter.post(
    "/:reservationId/payment",
    authenticationMiddleware,
    requireRoles("CUSTOMER"),
    async (request, response) => {
      const user = request.authenticatedUser;
      const reservationIdResult = z
        .uuid()
        .safeParse(request.params.reservationId);
      const bodyResult = processPaymentSchema.safeParse(request.body);

      if (!user) {
        response.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
        return;
      }

      if (!reservationIdResult.success) {
        response.status(404).json({
          error: {
            code: "RESERVATION_NOT_FOUND",
            message: "Reservation not found",
          },
        });
        return;
      }

      if (!bodyResult.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
          },
        });
        return;
      }

      try {
        const payment = await processPayment({
          reservationId: reservationIdResult.data,
          customerId: user.id,
          outcome: bodyResult.data.outcome,
        });

        response.status(200).json(payment);
      } catch (error: unknown) {
        if (error instanceof ReservationNotFoundError) {
          response.status(404).json({
            error: {
              code: "RESERVATION_NOT_FOUND",
              message: "Reservation not found",
            },
          });
          return;
        }

        if (error instanceof ReservationExpiredError) {
          response.status(409).json({
            error: {
              code: "RESERVATION_EXPIRED",
              message: "Reservation has expired",
            },
          });
          return;
        }

        if (error instanceof ReservationCannotBePaidError) {
          response.status(409).json({
            error: {
              code: "RESERVATION_CANNOT_BE_PAID",
              message: "Reservation cannot be paid",
            },
          });
          return;
        }

        throw error;
      }
    },
  );

  return paymentsRouter;
}
