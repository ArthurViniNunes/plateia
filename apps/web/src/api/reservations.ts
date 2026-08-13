import { z } from "zod";

import { env } from "../config/env";

const reservationResponseSchema = z
  .object({
    id: z.uuid(),
    eventId: z.uuid(),
    status: z.literal("PENDING"),
    expiresAt: z.iso.datetime(),
    totalInCents: z.number().int().positive(),
    seats: z.array(
      z
        .object({
          id: z.uuid(),
          rowLabel: z.string().min(1),
          number: z.number().int().positive(),
          priceInCents: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict();

export class SeatsUnavailableError extends Error {
  constructor() {
    super("Selected seats are unavailable");
    this.name = "SeatsUnavailableError";
  }
}

interface CreateReservationInput {
  eventId: string;
  seatIds: string[];
  accessToken: string;
}

export type Reservation = z.infer<typeof reservationResponseSchema>;

export async function createReservation({
  eventId,
  seatIds,
  accessToken,
}: CreateReservationInput): Promise<Reservation> {
  const response = await fetch(
    `${env.apiBaseUrl}/api/events/${eventId}/reservations`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seatIds,
      }),
    },
  );

  if (response.status === 409) {
    throw new SeatsUnavailableError();
  }

  if (!response.ok) {
    throw new Error("Não foi possível reservar os assentos.");
  }

  const payload: unknown = await response.json();

  return reservationResponseSchema.parse(payload);
}
