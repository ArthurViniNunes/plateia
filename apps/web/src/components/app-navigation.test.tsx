import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppNavigation } from "./app-navigation.tsx";
import { saveAuthenticatedSession } from "../session/auth-session";

describe("AppNavigation", () => {
  it("shows role-specific navigation and ends the session", async () => {
    sessionStorage.setItem("plateia:access-token", "organizer-access-token");

    sessionStorage.setItem(
      "plateia:authenticated-user",
      JSON.stringify({
        id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        role: "ORGANIZER",
      }),
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/organizer/events"]}>
        <AppNavigation />

        <Routes>
          <Route path="/login" element={<h1>Sessão encerrada</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", {
        name: "Plateia",
      }),
    ).toHaveAttribute("href", "/");

    expect(
      screen.getByRole("link", {
        name: "Gerenciar eventos",
      }),
    ).toHaveAttribute("href", "/organizer/events");

    expect(
      screen.queryByRole("link", {
        name: "Meus ingressos",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Sair",
      }),
    );

    expect(sessionStorage.getItem("plateia:access-token")).toBeNull();

    expect(sessionStorage.getItem("plateia:authenticated-user")).toBeNull();

    expect(
      await screen.findByRole("heading", {
        name: "Sessão encerrada",
      }),
    ).toBeInTheDocument();
  });

  it("updates the navigation when a session is created", async () => {
    const user = userEvent.setup();

    function LoginSimulator() {
      return (
        <button
          onClick={() => {
            saveAuthenticatedSession("organizer-access-token", {
              id: "1c8ef142-4fcb-4f8a-a108-55ee12e2f001",
              name: "Organizador Plateia",
              email: "organizer@plateia.local",
              role: "ORGANIZER",
            });
          }}
          type="button"
        >
          Simular login
        </button>
      );
    }

    render(
      <MemoryRouter>
        <AppNavigation />
        <LoginSimulator />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", {
        name: "Gerenciar eventos",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Simular login",
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "Gerenciar eventos",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: "Entrar",
      }),
    ).not.toBeInTheDocument();
  });
});
