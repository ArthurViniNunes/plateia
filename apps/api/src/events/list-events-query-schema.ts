import { z } from "zod";

const dateSchema = z.iso.date();

export const listEventsQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    startsFrom: dateSchema.optional(),
    startsTo: dateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine(
    ({ startsFrom, startsTo }) =>
      !startsFrom || !startsTo || startsFrom <= startsTo,
    {
      path: ["startsTo"],
      message: "startsTo must not precede startsFrom",
    },
  )
  .transform((query) => ({
    search: query.search,
    city: query.city,
    startsFrom: query.startsFrom
      ? new Date(`${query.startsFrom}T00:00:00.000Z`)
      : undefined,
    startsTo: query.startsTo
      ? new Date(`${query.startsTo}T23:59:59.999Z`)
      : undefined,
    page: query.page,
    limit: query.limit,
  }));

export type ListEventsQuery = z.output<typeof listEventsQuerySchema>;
