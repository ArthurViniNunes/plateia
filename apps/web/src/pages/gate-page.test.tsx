import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GatePage } from "./gate-page";

const eventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";
const ticketId = "1c8ef142-4fcb-4f8a-a108-55ee12e2f002";
const ticketCode = "ticket-code-with-at-least-thirty-two-characters";

const fetchMock = vi.fn<typeof fetch>();

describe("GatePage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("validates a ticket by its manually entered code", async () => {
    sessionStorage.setItem("plateia:access-token", "gatekeeper-access-token");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          result: "VALID",
          validatedAt: "2099-08-20T22:00:00.000Z",
          ticket: {
            id: ticketId,
            eventId,
            seat: {
              rowLabel: "A",
              number: 1,
            },
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
      <MemoryRouter>
        <GatePage />
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Identificador do evento",
      }),
      eventId,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Código do ingresso",
      }),
      ticketCode,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Validar ingresso",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/gate/validate",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer gatekeeper-access-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId,
            code: ticketCode,
          }),
        },
      );
    });

    expect(
      await screen.findByRole("heading", {
        name: "Ingresso válido",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Assento A1")).toBeInTheDocument();
  });

  it("opens and closes the QR camera reader", async () => {
    sessionStorage.setItem("plateia:access-token", "gatekeeper-access-token");

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GatePage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByLabelText("Leitor de QR pela câmera"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Ler QR pela câmera",
      }),
    );

    expect(
      screen.getByLabelText("Leitor de QR pela câmera"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Fechar câmera",
      }),
    );

    expect(
      screen.queryByLabelText("Leitor de QR pela câmera"),
    ).not.toBeInTheDocument();
  });
});
