import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535),
  CORS_ORIGIN: z
    .url()
    .refine((value) => new URL(value).origin === value, {
      message: "CORS_ORIGIN must contain only the URL origin",
    }),
});

export function parseEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}