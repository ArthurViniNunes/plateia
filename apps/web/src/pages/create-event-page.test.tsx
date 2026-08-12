import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateEventPage } from "./create-event-page";

const fetchMock = vi.fn<typeof fetch>();

describe("CreateEventPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("searches the Ticketmaster catalog and selects an event", async () => {
    sessionStorage.setItem("plateia:access-token", "organizer-access-token");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [
            {
              id: "ticketmaster-festival-1",
              title: "Festival Plateia",
              imageUrl: "https://images.example/festival.jpg",
              classification: "Music",
              externalUrl: "https://ticketmaster.example/festival",
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
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: "Pesquisar shows",
      }),
      "festival",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Pesquisar catálogo",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/catalog/events?query=festival",
        {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer organizer-access-token",
          },
        },
      );
    });

    expect(
      await screen.findByRole("heading", {
        name: "Festival Plateia",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Music")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Selecionar Festival Plateia",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Configure sua sessão",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Baseado em Festival Plateia")).toBeInTheDocument();
  });

  it("creates a draft with venue, price and numbered seats", async () => {
    sessionStorage.setItem("plateia:access-token", "organizer-access-token");

    const createdEventId = "7c8ef142-4fcb-4f8a-a108-55ee12e2f001";

    fetchMock.mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (
        url.endsWith("/api/catalog/events?query=festival") &&
        (!init?.method || init.method === "GET")
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: [
                {
                  id: "ticketmaster-festival-1",
                  title: "Festival Plateia",
                  imageUrl: null,
                  classification: "Music",
                  externalUrl: null,
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
      }

      if (url.endsWith("/api/events") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: createdEventId,
              ticketmasterId: "ticketmaster-festival-1",
              title: "Festival Plateia",
              imageUrl: null,
              classification: "Music",
              externalUrl: null,
              startsAt: "2099-08-20T23:00:00.000Z",
              venue: {
                name: "Teatro Plateia",
                address: "Rua da Cultura, 100",
                city: "Fortaleza",
                state: "CE",
              },
              priceInCents: 15_000,
              status: "DRAFT",
              capacity: 10,
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
      <MemoryRouter initialEntries={["/organizer/events/new"]}>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: "Pesquisar shows",
      }),
      "festival",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Pesquisar catálogo",
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Selecionar Festival Plateia",
      }),
    );

    fireEvent.change(screen.getByLabelText(/^Data e horário/), {
      target: {
        value: "2099-08-20T20:00",
      },
    });

    await user.type(
      screen.getByRole("textbox", {
        name: "Nome do local",
      }),
      "Teatro Plateia",
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Endereço",
      }),
      "Rua da Cultura, 100",
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Cidade",
      }),
      "Fortaleza",
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Estado",
      }),
      "CE",
    );

    await user.type(
      screen.getByRole("spinbutton", {
        name: "Preço por assento em reais",
      }),
      "150",
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Fileira 1",
      }),
      "A",
    );

    await user.type(
      screen.getByRole("spinbutton", {
        name: "Quantidade de assentos da fileira 1",
      }),
      "10",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Criar rascunho",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3333/api/events",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer organizer-access-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticketmasterId: "ticketmaster-festival-1",
            startsAt: "2099-08-20T20:00:00-03:00",
            venue: {
              name: "Teatro Plateia",
              address: "Rua da Cultura, 100",
              city: "Fortaleza",
              state: "CE",
            },
            priceInCents: 15_000,
            rows: [
              {
                label: "A",
                seatCount: 10,
              },
            ],
          }),
        },
      );
    });

    expect(
      await screen.findByText("Festival Plateia foi salvo como rascunho."),
    ).toBeInTheDocument();
  });
});
