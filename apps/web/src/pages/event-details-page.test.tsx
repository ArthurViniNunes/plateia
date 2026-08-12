import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const eventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";

const eventSummary = {
  id: eventId,
  ticketmasterId: "ticketmaster-festival-1",
  title: "Festival Plateia",
  imageUrl: "https://images.example/festival.jpg",
  classification: "Music",
  externalUrl: "https://ticketmaster.example/festival",
  startsAt: "2099-08-20T23:00:00.000Z",
  venue: {
    name: "Teatro Plateia",
    address: "Rua da Cultura, 100",
    city: "Fortaleza",
    state: "CE",
  },
  priceInCents: 15_000,
  status: "PUBLISHED",
  capacity: 3,
};

const eventDetails = {
  ...eventSummary,
  rows: [
    {
      label: "A",
      seats: [
        {
          id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
          number: 1,
          status: "AVAILABLE",
        },
        {
          id: "2c8ef142-4fcb-4f8a-a108-55ee12e2f002",
          number: 2,
          status: "AVAILABLE",
        },
      ],
    },
    {
      label: "B",
      seats: [
        {
          id: "3c8ef142-4fcb-4f8a-a108-55ee12e2f003",
          number: 1,
          status: "AVAILABLE",
        },
      ],
    },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

describe("event details", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("navigates from the catalog to the event seat map", async () => {
    fetchMock.mockImplementation((input) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/api/events?page=1&limit=12")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [eventSummary],
              pagination: {
                page: 1,
                limit: 12,
                total: 1,
                totalPages: 1,
              },
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

      if (url.endsWith(`/api/events/${eventId}`)) {
        return Promise.resolve(
          new Response(JSON.stringify(eventDetails), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }),
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
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("link", {
        name: /Festival Plateia/,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Escolha seu lugar",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Festival Plateia",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Assento A1 disponível",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Assento A2 disponível",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Assento B1 disponível",
      }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3333/api/events/${eventId}`,
      expect.objectContaining({
        headers: {
          Accept: "application/json",
        },
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Assento A1 disponível",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Assento A2 disponível",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Assento A1 selecionado",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Assento A2 selecionado",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("2 assentos selecionados")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 300,00")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Continuar para reservar",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Entre para continuar",
      }),
    ).toBeInTheDocument();
  });
});
