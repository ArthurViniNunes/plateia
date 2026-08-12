import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrganizerEventsPage } from "./organizer-events-page";

const draftEventId = "1c8ef142-4fcb-4f8a-a108-55ee12e2f001";
const publishedEventId = "2c8ef142-4fcb-4f8a-a108-55ee12e2f002";

const fetchMock = vi.fn<typeof fetch>();

function createEvent(
  id: string,
  title: string,
  status: "DRAFT" | "PUBLISHED" | "CANCELLED",
) {
  return {
    id,
    ticketmasterId: `ticketmaster-${id}`,
    title,
    imageUrl: null,
    classification: "Music",
    externalUrl: null,
    startsAt: "2099-08-20T23:00:00.000Z",
    venue: {
      name: "Teatro Plateia",
      address: "Rua da Cultura, 100",
      city: "Fortaleza",
      state: "CE",
    },
    priceInCents: 15_000,
    status,
    capacity: 100,
  };
}

describe("OrganizerEventsPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("lists the organizer's events and publishes a draft", async () => {
    sessionStorage.setItem("plateia:access-token", "organizer-access-token");

    const draftEvent = createEvent(
      draftEventId,
      "Festival em preparação",
      "DRAFT",
    );

    const publishedEvent = createEvent(
      publishedEventId,
      "Festival publicado",
      "PUBLISHED",
    );

    fetchMock.mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (
        url.endsWith("/api/events/mine") &&
        (!init?.method || init.method === "GET")
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: [draftEvent, publishedEvent],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      if (
        url.endsWith(`/api/events/${draftEventId}/publish`) &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...draftEvent,
              status: "PUBLISHED",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(null, {
          status: 404,
        }),
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrganizerEventsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Meus eventos",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Festival em preparação",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Festival publicado",
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/events/mine",
        {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer organizer-access-token",
          },
        },
      );
    });

    await user.click(
      screen.getByRole("button", {
        name: "Publicar Festival em preparação",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3333/api/events/${draftEventId}/publish`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer organizer-access-token",
          },
        },
      );
    });

    expect(
      await screen.findByText("Festival em preparação foi publicado."),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Publicar Festival em preparação",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Cancelar Festival em preparação",
      }),
    ).toBeInTheDocument();
  });

  it("cancels a published event", async () => {
    sessionStorage.setItem("plateia:access-token", "organizer-access-token");

    const publishedEvent = createEvent(
      publishedEventId,
      "Festival publicado",
      "PUBLISHED",
    );

    fetchMock.mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (
        url.endsWith("/api/events/mine") &&
        (!init?.method || init.method === "GET")
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: [publishedEvent],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      if (
        url.endsWith(`/api/events/${publishedEventId}/cancel`) &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...publishedEvent,
              status: "CANCELLED",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(null, {
          status: 404,
        }),
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrganizerEventsPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Cancelar Festival publicado",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3333/api/events/${publishedEventId}/cancel`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer organizer-access-token",
          },
        },
      );
    });

    expect(
      await screen.findByText("Festival publicado foi cancelado."),
    ).toBeInTheDocument();

    expect(screen.getByText("Cancelado")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Cancelar Festival publicado",
      }),
    ).not.toBeInTheDocument();
  });
});
