import { z } from "zod";

export const createReservationSchema = z.object({
  seatIds: z
    .array(z.uuid())
    .min(1)
    .max(4)
    .refine((seatIds) => new Set(seatIds).size === seatIds.length, {
      message: "seatIds must be unique",
    }),
});
