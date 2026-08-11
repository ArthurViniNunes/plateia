import { describe, expect, it, vi } from "vitest";

import { createTicketmasterClient } from "../../src/catalog/ticketmaster-client.js";

describe("Ticketmaster client", () => {
  it("searches Brazilian events and maps the external response", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    fetchImplementation.mockResolvedValue(
      new Response(
        JSON.stringify({
          _embedded: {
            events: [
              {
                id: "ticketmaster-event-1",
                name: "Festival Plateia",
                url: "https://ticketmaster.example/events/1",
                images: [
                  {
                    ratio: "4_3",
                    url: "https://images.example/square.jpg",
                    width: 800,
                  },
                  {
                    ratio: "16_9",
                    url: "https://images.example/small.jpg",
                    width: 640,
                  },
                  {
                    ratio: "16_9",
                    url: "https://images.example/large.jpg",
                    width: 1920,
                  },
                ],
                classifications: [
                  {
                    segment: {
                      name: "Music",
                    },
                    genre: {
                      name: "Rock",
                    },
                  },
                ],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const client = createTicketmasterClient({
      apiKey: "ticketmaster-test-key",
      fetchImplementation,
      timeoutMs: 5_000,
    });

    const events = await client.searchEvents("festival");

    expect(fetchImplementation).toHaveBeenCalledOnce();

    const requestedResource = fetchImplementation.mock.calls[0]?.[0];

    expect(requestedResource).toBeInstanceOf(URL);

    if (!(requestedResource instanceof URL)) {
      throw new Error("Expected Ticketmaster request to use a URL");
    }

    expect(requestedResource.origin).toBe("https://app.ticketmaster.com");
    expect(requestedResource.pathname).toBe(
      "/discovery/v2/events.json",
    );
    expect(requestedResource.searchParams.get("apikey")).toBe(
      "ticketmaster-test-key",
    );
    expect(requestedResource.searchParams.get("keyword")).toBe("festival");
    expect(requestedResource.searchParams.get("countryCode")).toBe("BR");
    expect(requestedResource.searchParams.get("size")).toBe("12");

    expect(events).toEqual([
      {
        id: "ticketmaster-event-1",
        title: "Festival Plateia",
        imageUrl: "https://images.example/large.jpg",
        classification: "Music",
        externalUrl: "https://ticketmaster.example/events/1",
      },
    ]);
  });

  it("reports the catalog as unavailable when the API key is missing", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    const client = createTicketmasterClient({
        fetchImplementation,
    });

    await expect(
        client.searchEvents("festival"),
    ).rejects.toMatchObject({
        name: "TicketmasterUnavailableError",
        message: "Ticketmaster catalog is unavailable",
    });

    expect(fetchImplementation).not.toHaveBeenCalled();
    });

    it.each([401, 429, 500])(
    "converts Ticketmaster status %s into an unavailable error",
    async (status) => {
        const fetchImplementation = vi.fn<typeof fetch>();

        fetchImplementation.mockResolvedValue(
        new Response(null, {
            status,
        }),
        );

        const client = createTicketmasterClient({
        apiKey: "ticketmaster-test-key",
        fetchImplementation,
        });

        await expect(
        client.searchEvents("festival"),
        ).rejects.toMatchObject({
        name: "TicketmasterUnavailableError",
        message: "Ticketmaster catalog is unavailable",
        });
    },
    );

    it("converts a network failure into an unavailable error", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    fetchImplementation.mockRejectedValue(
        new TypeError("Network failure"),
    );

    const client = createTicketmasterClient({
        apiKey: "ticketmaster-test-key",
        fetchImplementation,
    });

    await expect(
        client.searchEvents("festival"),
    ).rejects.toMatchObject({
        name: "TicketmasterUnavailableError",
        message: "Ticketmaster catalog is unavailable",
    });
    });

    it("converts a timeout into an unavailable error", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    fetchImplementation.mockRejectedValue(
        new DOMException("Request timed out", "TimeoutError"),
    );

    const client = createTicketmasterClient({
        apiKey: "ticketmaster-test-key",
        fetchImplementation,
    });

    await expect(
        client.searchEvents("festival"),
    ).rejects.toMatchObject({
        name: "TicketmasterUnavailableError",
        message: "Ticketmaster catalog is unavailable",
    });
    });

    it("converts an invalid response into an unavailable error", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    fetchImplementation.mockResolvedValue(
        new Response("null", {
        status: 200,
        headers: {
            "content-type": "application/json",
        },
        }),
    );

    const client = createTicketmasterClient({
        apiKey: "ticketmaster-test-key",
        fetchImplementation,
    });

    await expect(
        client.searchEvents("festival"),
    ).rejects.toMatchObject({
        name: "TicketmasterUnavailableError",
        message: "Ticketmaster catalog is unavailable",
    });
    });
});