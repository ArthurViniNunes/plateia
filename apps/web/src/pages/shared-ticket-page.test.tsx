import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedTicketPage } from "./shared-ticket-page";

const ticketCode = "ticket-code-with-at-least-thirty-two-characters";
const fetchMock = vi.fn<typeof fetch>();

describe("SharedTicketPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows a public ticket and its QR code", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
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

    render(
      <MemoryRouter initialEntries={[`/tickets/${ticketCode}`]}>
        <Routes>
          <Route path="/tickets/:code" element={<SharedTicketPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Festival Plateia",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Ingresso válido")).toBeInTheDocument();
    expect(screen.getByText("Teatro Plateia")).toBeInTheDocument();
    expect(screen.getByText("Fortaleza, CE")).toBeInTheDocument();
    expect(screen.getByText("Assento A1")).toBeInTheDocument();

    expect(
      screen.getByRole("img", {
        name: "QR Code do ingresso",
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3333/api/tickets/${ticketCode}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );
    });
  });
});
