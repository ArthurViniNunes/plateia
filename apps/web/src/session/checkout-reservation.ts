import { z } from "zod";

const checkoutReservationSchema = z
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

export type CheckoutReservation = z.infer<typeof checkoutReservationSchema>;

const storageKey = "plateia:checkout-reservation";

export function saveCheckoutReservation(reservation: CheckoutReservation) {
  sessionStorage.setItem(storageKey, JSON.stringify(reservation));
}

export function readCheckoutReservation(): CheckoutReservation | null {
  const storedReservation = sessionStorage.getItem(storageKey);

  if (!storedReservation) {
    return null;
  }

  try {
    const parsedReservation = JSON.parse(storedReservation) as unknown;
    const result = checkoutReservationSchema.safeParse(parsedReservation);

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

export function clearCheckoutReservation() {
  sessionStorage.removeItem(storageKey);
}
