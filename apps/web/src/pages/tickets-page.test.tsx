import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketsPage } from "./tickets-page";

const ticketCode = "ticket-code-with-at-least-thirty-two-characters";
const fetchMock = vi.fn<typeof fetch>();

describe("TicketsPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("lists the customer's tickets and opens the shared ticket", async () => {
    sessionStorage.setItem("plateia:access-token", "valid-access-token");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          tickets: [
            {
              id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
              code: ticketCode,
              status: "VALID",
              event: {
                id: "2c8ef142-4fcb-4f8a-a108-55ee12e2f002",
                title: "Festival Plateia",
                startsAt: "2099-08-20T23:00:00.000Z",
                venue: {
                  name: "Teatro Plateia",
                  city: "Fortaleza",
                  state: "CE",
                },
              },
              seat: {
                id: "3c8ef142-4fcb-4f8a-a108-55ee12e2f003",
                rowLabel: "A",
                number: 1,
              },
              sharePath: `/tickets/${ticketCode}`,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <Routes>
          <Route path="/tickets" element={<TicketsPage />} />
          <Route
            path="/tickets/:code"
            element={<h1>Ingresso compartilhável</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Meus ingressos",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Festival Plateia",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Teatro Plateia")).toBeInTheDocument();
    expect(screen.getByText("Fortaleza, CE")).toBeInTheDocument();
    expect(screen.getByText("Assento A1")).toBeInTheDocument();
    expect(screen.getByText("Válido")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/tickets",
        {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer valid-access-token",
          },
        },
      );
    });

    await user.click(
      screen.getByRole("link", {
        name: "Abrir ingresso Festival Plateia, assento A1",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Ingresso compartilhável",
      }),
    ).toBeInTheDocument();
  });
});
