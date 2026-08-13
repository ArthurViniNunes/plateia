import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./login-page";

const eventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";
const fetchMock = vi.fn<typeof fetch>();

describe("LoginPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("authenticates, stores the access token and returns to the previous route", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "valid-access-token",
          user: {
            id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
            name: "Cliente Plateia",
            email: "customer@plateia.local",
            role: "CUSTOMER",
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

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const returnTo = `/events/${eventId}`;

    render(
      <MemoryRouter
        initialEntries={[`/login?returnTo=${encodeURIComponent(returnTo)}`]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events/:eventId" element={<h1>Reserva pendente</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "E-mail",
      }),
      "customer@plateia.local",
    );

    await user.type(screen.getByLabelText(/^Senha/), "Plateia123!");

    await user.click(
      screen.getByRole("button", {
        name: "Entrar",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/auth/login",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "customer@plateia.local",
            password: "Plateia123!",
          }),
        },
      );
    });

    expect(sessionStorage.getItem("plateia:access-token")).toBe(
      "valid-access-token",
    );

    expect(
      await screen.findByRole("heading", {
        name: "Reserva pendente",
      }),
    ).toBeInTheDocument();
  });

  it("authenticates values filled by the browser without requiring a second submit", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "valid-access-token",
          user: {
            id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
            name: "Cliente Plateia",
            email: "customer@plateia.local",
            role: "CUSTOMER",
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

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Agenda Plateia</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    const emailInput = screen.getByRole("textbox", {
      name: "E-mail",
    });

    const passwordInput = screen.getByLabelText(/^Senha/);

    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );

    // Simula o preenchimento automático sem disparar um evento change do React.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const valueSetter = valueDescriptor?.set;

    if (!valueSetter) {
      throw new Error("HTML input value setter is unavailable");
    }

    Reflect.apply(valueSetter, emailInput, ["customer@plateia.local"]);
    Reflect.apply(valueSetter, passwordInput, ["Plateia123!"]);

    await user.click(
      screen.getByRole("button", {
        name: "Entrar",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/auth/login",
      expect.objectContaining({
        body: JSON.stringify({
          email: "customer@plateia.local",
          password: "Plateia123!",
        }),
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Agenda Plateia",
      }),
    ).toBeInTheDocument();
  });

  it("creates the pending reservation after login and opens the checkout", async () => {
    const reservationId = "8c8ef142-4fcb-4f8a-a108-55ee12e2f008";
    const firstSeatId = "1c8ef142-4fcb-4f8a-a108-55ee12e2f001";
    const secondSeatId = "2c8ef142-4fcb-4f8a-a108-55ee12e2f002";

    sessionStorage.setItem(
      "plateia:pending-reservation",
      JSON.stringify({
        eventId,
        seatIds: [firstSeatId, secondSeatId],
      }),
    );

    fetchMock.mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              token: "valid-access-token",
              user: {
                id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f010",
                name: "Cliente Plateia",
                email: "customer@plateia.local",
                role: "CUSTOMER",
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

      if (
        url.endsWith(`/api/events/${eventId}/reservations`) &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
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
      <MemoryRouter
        initialEntries={[
          `/login?returnTo=${encodeURIComponent(`/events/${eventId}`)}`,
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/checkout/:reservationId"
            element={<h1>Pagamento da reserva</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "E-mail",
      }),
      "customer@plateia.local",
    );

    await user.type(screen.getByLabelText(/^Senha/), "Plateia123!");

    await user.click(
      screen.getByRole("button", {
        name: "Entrar",
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
            seatIds: [firstSeatId, secondSeatId],
          }),
        },
      );
    });

    expect(sessionStorage.getItem("plateia:pending-reservation")).toBeNull();

    expect(
      await screen.findByRole("heading", {
        name: "Pagamento da reserva",
      }),
    ).toBeInTheDocument();
  });
});
