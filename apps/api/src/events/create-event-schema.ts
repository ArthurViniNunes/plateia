import { z } from "zod";

const rowSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((label) => label.toUpperCase()),
  seatCount: z.number().int().min(1).max(100),
});

export const createEventSchema = z
  .object({
    ticketmasterId: z.string().trim().min(1).max(100),
    startsAt: z.iso
      .datetime({
        offset: true,
      })
      .transform((value) => new Date(value))
      .refine(
        (value) => value.getTime() > Date.now(),
        "Event date must be in the future",
      ),
    venue: z.object({
      name: z.string().trim().min(2).max(120),
      address: z.string().trim().min(2).max(200),
      city: z.string().trim().min(2).max(120),
      state: z
        .string()
        .trim()
        .regex(/^[a-zA-Z]{2}$/)
        .transform((state) => state.toUpperCase()),
    }),
    priceInCents: z
      .number()
      .int()
      .positive()
      .max(2_147_483_647),
    rows: z.array(rowSchema).min(1).max(26),
  })
  .superRefine(({ rows }, context) => {
    const labels = new Set<string>();

    rows.forEach((row, index) => {
      if (labels.has(row.label)) {
        context.addIssue({
          code: "custom",
          message: "Row labels must be unique",
          path: ["rows", index, "label"],
        });
      }

      labels.add(row.label);
    });
  });

export type CreateEventInput = z.infer<
  typeof createEventSchema
>;