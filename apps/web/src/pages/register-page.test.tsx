import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterPage } from "./register-page.tsx";

const eventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";
const fetchMock = vi.fn<typeof fetch>();

describe("RegisterPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("registers a customer and redirects to login preserving returnTo", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
          name: "Arthur Vinicius Carneiro Nunes",
          email: "arthur@example.com",
          role: "CUSTOMER",
        }),
        {
          status: 201,
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
        initialEntries={[`/register?returnTo=${encodeURIComponent(returnTo)}`]}
      >
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/login"
            element={<h1>Cadastro concluído. Entre para continuar</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Nome completo",
      }),
      "Arthur Vinicius Carneiro Nunes",
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "E-mail",
      }),
      "arthur@example.com",
    );

    await user.type(screen.getByLabelText(/^Senha/), "Plateia123!");

    await user.click(
      screen.getByRole("button", {
        name: "Criar conta",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/auth/register",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Arthur Vinicius Carneiro Nunes",
            email: "arthur@example.com",
            password: "Plateia123!",
          }),
        },
      );
    });

    expect(
      await screen.findByRole("heading", {
        name: "Cadastro concluído. Entre para continuar",
      }),
    ).toBeInTheDocument();
  });
});
