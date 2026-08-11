import { z } from "zod";

export interface CatalogEvent {
  id: string;
  title: string;
  imageUrl: string | null;
  classification: string | null;
  externalUrl: string | null;
}

export interface CatalogClient {
  searchEvents(query: string): Promise<CatalogEvent[]>;
  getEventById(id: string): Promise<CatalogEvent>;
}

interface CreateTicketmasterClientOptions {
  apiKey?: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}

export class TicketmasterUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Ticketmaster catalog is unavailable", options);
    this.name = "TicketmasterUnavailableError";
  }
}

export class CatalogEventNotFoundError extends Error {
  constructor(options?: ErrorOptions) {
    super("Catalog event not found", options);
    this.name = "CatalogEventNotFoundError";
  }
}

const ticketmasterImageSchema = z.object({
  ratio: z.string().optional(),
  url: z.url(),
  width: z.number().optional(),
});

const ticketmasterClassificationSchema = z.object({
  segment: z
    .object({
      name: z.string(),
    })
    .optional(),
  genre: z
    .object({
      name: z.string(),
    })
    .optional(),
});

const ticketmasterEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url().optional(),
  images: z.array(ticketmasterImageSchema).optional(),
  classifications: z.array(ticketmasterClassificationSchema).optional(),
});

const ticketmasterSearchResponseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(ticketmasterEventSchema),
    })
    .optional(),
});

function selectImage(
  images: z.infer<typeof ticketmasterImageSchema>[] = [],
): string | null {
  const widescreenImages = images.filter((image) => image.ratio === "16_9");

  const candidates = widescreenImages.length > 0 ? widescreenImages : images;

  const selectedImage = candidates.toSorted(
    (first, second) => (second.width ?? 0) - (first.width ?? 0),
  )[0];

  return selectedImage?.url ?? null;
}

function selectClassification(
  classifications:
    z.infer<typeof ticketmasterClassificationSchema>[] | undefined,
): string | null {
  const classification = classifications?.[0];

  return classification?.segment?.name ?? classification?.genre?.name ?? null;
}

function mapCatalogEvent(
  event: z.infer<typeof ticketmasterEventSchema>,
): CatalogEvent {
  return {
    id: event.id,
    title: event.name,
    imageUrl: selectImage(event.images),
    classification: selectClassification(event.classifications),
    externalUrl: event.url ?? null,
  };
}

export function createTicketmasterClient({
  apiKey,
  fetchImplementation = fetch,
  timeoutMs = 5_000,
}: CreateTicketmasterClientOptions): CatalogClient {
  function requireApiKey(): string {
    if (!apiKey) {
      throw new TicketmasterUnavailableError();
    }

    return apiKey;
  }

  async function requestTicketmaster<T>(
    url: URL,
    schema: z.ZodType<T>,
    notFoundError?: () => Error,
  ): Promise<T> {
    try {
      const response = await fetchImplementation(url, {
        headers: {
          accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404 && notFoundError) {
        throw notFoundError();
      }

      if (!response.ok) {
        throw new TicketmasterUnavailableError({
          cause: new Error(
            `Ticketmaster responded with status ${response.status}`,
          ),
        });
      }

      const payload: unknown = await response.json();

      return schema.parse(payload);
    } catch (error: unknown) {
      if (
        error instanceof TicketmasterUnavailableError ||
        error instanceof CatalogEventNotFoundError
      ) {
        throw error;
      }

      throw new TicketmasterUnavailableError({
        cause: error,
      });
    }
  }

  return {
    async searchEvents(query: string): Promise<CatalogEvent[]> {
      const url = new URL(
        "https://app.ticketmaster.com/discovery/v2/events.json",
      );

      url.searchParams.set("apikey", requireApiKey());
      url.searchParams.set("keyword", query);
      url.searchParams.set("countryCode", "BR");
      url.searchParams.set("size", "12");

      const response = await requestTicketmaster(
        url,
        ticketmasterSearchResponseSchema,
      );

      return (response._embedded?.events ?? []).map(mapCatalogEvent);
    },

    async getEventById(id: string): Promise<CatalogEvent> {
      const url = new URL(
        `https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json`,
      );

      url.searchParams.set("apikey", requireApiKey());

      const event = await requestTicketmaster(
        url,
        ticketmasterEventSchema,
        () => new CatalogEventNotFoundError(),
      );

      return mapCatalogEvent(event);
    },
  };
}
