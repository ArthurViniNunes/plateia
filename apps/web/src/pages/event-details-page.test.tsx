import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { saveAuthenticatedSession } from "../session/auth-session";

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

  it("creates the reservation directly when the customer is already authenticated", async () => {
    saveAuthenticatedSession("valid-access-token", {
      id: "4c8ef142-4fcb-4f8a-a108-55ee12e2f004",
      name: "Cliente Plateia",
      email: "customer@plateia.local",
      role: "CUSTOMER",
    });

    fetchMock.mockImplementation((input, init) => {
      const url = getRequestUrl(input);

      if (
        url.endsWith(`/api/events/${eventId}`) &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(eventDetails), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }),
        );
      }

      if (
        url.endsWith(`/api/events/${eventId}/reservations`) &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "5c8ef142-4fcb-4f8a-a108-55ee12e2f005",
              eventId,
              status: "PENDING",
              expiresAt: "2099-08-20T22:10:00.000Z",
              totalInCents: 15_000,
              seats: [
                {
                  id: eventDetails.rows[0].seats[0].id,
                  rowLabel: "A",
                  number: 1,
                  priceInCents: 15_000,
                },
              ],
            }),
            {
              status: 201,
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
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Assento A1 disponível",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Continuar para reservar",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3333/api/events/${eventId}/reservations`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer valid-access-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            seatIds: [eventDetails.rows[0].seats[0].id],
          }),
        },
      );
    });

    expect(
      screen.queryByRole("heading", {
        name: "Entre para continuar",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows blocked and sold seats as unavailable", async () => {
    const detailsWithUnavailableSeats = {
      ...eventDetails,
      rows: [
        {
          label: "A",
          seats: [
            eventDetails.rows[0].seats[0],
            {
              ...eventDetails.rows[0].seats[1],
              status: "BLOCKED",
            },
          ],
        },
        {
          label: "B",
          seats: [
            {
              ...eventDetails.rows[1].seats[0],
              status: "SOLD",
            },
          ],
        },
      ],
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(detailsWithUnavailableSeats), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", {
        name: "Assento A1 disponível",
      }),
    ).toBeEnabled();

    expect(
      screen.getByRole("button", {
        name: "Assento A2 temporariamente reservado",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Assento B1 vendido",
      }),
    ).toBeDisabled();

    expect(screen.getByText("Temporariamente reservado")).toBeInTheDocument();
    expect(screen.getByText("Vendido")).toBeInTheDocument();
  });

  it("refreshes seat availability while the map remains open", async () => {
    vi.useFakeTimers();

    const detailsWithBlockedSeat = {
      ...eventDetails,
      rows: [
        {
          label: "A",
          seats: [
            eventDetails.rows[0].seats[0],
            {
              ...eventDetails.rows[0].seats[1],
              status: "BLOCKED",
            },
          ],
        },
        eventDetails.rows[1],
      ],
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(eventDetails), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(detailsWithBlockedSeat), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", {
        name: "Assento A2 disponível",
      }),
    ).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(
      screen.getByRole("button", {
        name: "Assento A2 temporariamente reservado",
      }),
    ).toBeDisabled();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes the map immediately when a selected seat becomes unavailable", async () => {
    saveAuthenticatedSession("valid-access-token", {
      id: "4c8ef142-4fcb-4f8a-a108-55ee12e2f004",
      name: "Cliente Plateia",
      email: "customer@plateia.local",
      role: "CUSTOMER",
    });

    const detailsWithBlockedSeat = {
      ...eventDetails,
      rows: [
        {
          label: "A",
          seats: [
            {
              ...eventDetails.rows[0].seats[0],
              status: "BLOCKED",
            },
            eventDetails.rows[0].seats[1],
          ],
        },
        eventDetails.rows[1],
      ],
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(eventDetails), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "SEATS_UNAVAILABLE",
              message: "Selected seats are unavailable",
            },
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(detailsWithBlockedSeat), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Assento A1 disponível",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Continuar para reservar",
      }),
    );

    expect(
      await screen.findByText(
        "Um dos assentos selecionados acabou de ficar indisponível. Escolha novamente.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Assento A1 temporariamente reservado",
      }),
    ).toBeDisabled();

    expect(screen.getByText("Nenhum assento selecionado")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
