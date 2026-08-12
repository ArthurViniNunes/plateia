import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const eventsResponse = {
  data: [
    {
      id: "7c8ef142-4fcb-4f8a-a108-55ee12e2f001",
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
      capacity: 100,
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 1,
    totalPages: 1,
  },
};

const fetchMock = vi.fn<typeof fetch>();

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and presents the public event catalog", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(eventsResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Descubra o que ocupa a cidade",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        name: "Festival Plateia",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Fortaleza, CE")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "http://localhost:3333/api/events?page=1&limit=12",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
        },
      }),
    );
  });
});
