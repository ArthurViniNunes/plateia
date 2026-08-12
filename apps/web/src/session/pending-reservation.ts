import { z } from "zod";

const pendingReservationSchema = z
  .object({
    eventId: z.uuid(),
    seatIds: z
      .array(z.uuid())
      .min(1)
      .max(4)
      .refine((seatIds) => new Set(seatIds).size === seatIds.length, {
        message: "Seat identifiers must be unique",
      }),
  })
  .strict();

export type PendingReservation = z.infer<typeof pendingReservationSchema>;

const storageKey = "plateia:pending-reservation";

export function readPendingReservation(): PendingReservation | null {
  const storedReservation = sessionStorage.getItem(storageKey);

  if (!storedReservation) {
    return null;
  }

  try {
    const parsedReservation = JSON.parse(storedReservation) as unknown;
    const result = pendingReservationSchema.safeParse(parsedReservation);

    if (!result.success) {
      sessionStorage.removeItem(storageKey);
      return null;
    }

    return result.data;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function clearPendingReservation() {
  sessionStorage.removeItem(storageKey);
}
