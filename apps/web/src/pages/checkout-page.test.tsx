import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "./checkout-page.tsx";

const reservationId = "8c8ef142-4fcb-4f8a-a108-55ee12e2f008";
const eventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";

const firstSeatId = "1c8ef142-4fcb-4f8a-a108-55ee12e2f001";
const secondSeatId = "2c8ef142-4fcb-4f8a-a108-55ee12e2f002";

const fetchMock = vi.fn<typeof fetch>();

describe("CheckoutPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("approves the payment and opens the customer's tickets", async () => {
    sessionStorage.setItem("plateia:access-token", "valid-access-token");

    sessionStorage.setItem(
      "plateia:checkout-reservation",
      JSON.stringify({
        id: reservationId,
        eventId,
        status: "PENDING",
        expiresAt: "2099-08-20T22:10:00.000Z",
        totalInCents: 30_000,
        seats: [
          {
            id: firstSeatId,
            rowLabel: "A",
            number: 1,
            priceInCents: 15_000,
          },
          {
            id: secondSeatId,
            rowLabel: "A",
            number: 2,
            priceInCents: 15_000,
          },
        ],
      }),
    );

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: reservationId,
          status: "PAID",
          totalInCents: 30_000,
          tickets: [
            {
              id: "3c8ef142-4fcb-4f8a-a108-55ee12e2f003",
              code: "first-ticket-code-with-at-least-thirty-two-characters",
              eventId,
              seat: {
                id: firstSeatId,
                rowLabel: "A",
                number: 1,
              },
            },
            {
              id: "4c8ef142-4fcb-4f8a-a108-55ee12e2f004",
              code: "second-ticket-code-with-at-least-thirty-two-characters",
              eventId,
              seat: {
                id: secondSeatId,
                rowLabel: "A",
                number: 2,
              },
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
      <MemoryRouter initialEntries={[`/checkout/${reservationId}`]}>
        <Routes>
          <Route path="/checkout/:reservationId" element={<CheckoutPage />} />
          <Route path="/tickets" element={<h1>Meus ingressos</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Confirme seu pagamento",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Assentos A1 e A2")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 300,00")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Aprovar pagamento",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3333/api/reservations/${reservationId}/payment`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer valid-access-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            outcome: "APPROVED",
          }),
        },
      );
    });

    expect(sessionStorage.getItem("plateia:checkout-reservation")).toBeNull();

    expect(
      await screen.findByRole("heading", {
        name: "Meus ingressos",
      }),
    ).toBeInTheDocument();
  });
});
