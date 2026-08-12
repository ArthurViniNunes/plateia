import { z } from "zod";

import { env } from "../config/env";

const catalogEventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    imageUrl: z.url().nullable(),
    classification: z.string().nullable(),
    externalUrl: z.url().nullable(),
  })
  .strict();

const catalogResponseSchema = z
  .object({
    events: z.array(catalogEventSchema),
  })
  .strict();

export type CatalogEvent = z.infer<typeof catalogEventSchema>;

export async function searchCatalog(
  query: string,
  accessToken: string,
): Promise<CatalogEvent[]> {
  const searchParams = new URLSearchParams({
    query,
  });

  const response = await fetch(
    `${env.apiBaseUrl}/api/catalog/events?${searchParams.toString()}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível pesquisar o catálogo.");
  }

  const payload: unknown = await response.json();

  return catalogResponseSchema.parse(payload).events;
}
