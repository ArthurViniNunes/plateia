import { z } from "zod";

export const validateTicketSchema = z.object({
  eventId: z.uuid(),
  code: z.string().trim().min(1).max(200),
});
