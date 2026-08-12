import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EventSessionForm } from "../components/event-session-form";
import type { ManagedEvent } from "../api/managed-events";

import { type CatalogEvent, searchCatalog } from "../api/catalog";

export function CreateEventPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CatalogEvent | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<ManagedEvent | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(
        `/login?returnTo=${encodeURIComponent("/organizer/events/new")}`,
        {
          replace: true,
        },
      );
      return;
    }

    setErrorMessage(null);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await searchCatalog(query, accessToken);
      setEvents(response);
    } catch {
      setErrorMessage("Não foi possível pesquisar o catálogo da Ticketmaster.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        bgcolor: "background.default",
        minHeight: "100vh",
        py: { xs: 6, md: 9 },
      }}
    >
      <Container maxWidth="lg">
        <Button
          component={Link}
          startIcon={<ArrowBackIcon />}
          to="/organizer/events"
        >
          Voltar aos eventos
        </Button>

        <Typography
          variant="overline"
          sx={{
            color: "primary.main",
            display: "block",
            letterSpacing: "0.16em",
            mt: 4,
          }}
        >
          Novo evento
        </Typography>

        <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
          Encontre sua atração
        </Typography>

        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Pesquise a referência cultural que dará origem à sua sessão.
        </Typography>

        <Box
          component="form"
          onSubmit={(event) => {
            void handleSearch(event);
          }}
          sx={{ mt: 5 }}
        >
          <Stack
            spacing={2}
            sx={{
              alignItems: {
                xs: "stretch",
                sm: "flex-start",
              },
              flexDirection: {
                xs: "column",
                sm: "row",
              },
            }}
          >
            <TextField
              fullWidth
              label="Pesquisar shows"
              name="query"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              required
              slotProps={{
                htmlInput: {
                  minLength: 2,
                  maxLength: 100,
                },
              }}
              type="search"
              value={query}
            />

            <Button
              disabled={isSearching}
              size="large"
              startIcon={
                isSearching ? (
                  <CircularProgress
                    aria-label="Pesquisando catálogo"
                    color="inherit"
                    size={20}
                  />
                ) : (
                  <SearchIcon />
                )
              }
              type="submit"
              variant="contained"
              sx={{
                minHeight: 56,
                whiteSpace: "nowrap",
              }}
            >
              Pesquisar catálogo
            </Button>
          </Stack>
        </Box>

        {errorMessage && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {errorMessage}
          </Alert>
        )}

        {!errorMessage &&
          hasSearched &&
          !isSearching &&
          events.length === 0 && (
            <Alert severity="info" sx={{ mt: 3 }}>
              Nenhum evento foi encontrado.
            </Alert>
          )}

        {events.length > 0 && (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              mt: 5,
            }}
          >
            {events.map((catalogEvent) => (
              <Paper
                elevation={0}
                key={catalogEvent.id}
                square
                sx={{
                  border: "1px solid",
                  borderColor:
                    selectedEvent?.id === catalogEvent.id
                      ? "primary.main"
                      : "divider",
                  overflow: "hidden",
                }}
              >
                {catalogEvent.imageUrl && (
                  <Box
                    alt=""
                    component="img"
                    src={catalogEvent.imageUrl}
                    sx={{
                      aspectRatio: "16 / 9",
                      display: "block",
                      objectFit: "cover",
                      width: "100%",
                    }}
                  />
                )}

                <Stack spacing={2} sx={{ p: 3 }}>
                  <Typography color="primary.main" variant="overline">
                    {catalogEvent.classification ?? "Evento"}
                  </Typography>

                  <Typography component="h2" variant="h4">
                    {catalogEvent.title}
                  </Typography>

                  <Button
                    aria-label={`Selecionar ${catalogEvent.title}`}
                    onClick={() => {
                      setSelectedEvent(catalogEvent);
                      setCreatedEvent(null);
                    }}
                    type="button"
                    variant={
                      selectedEvent?.id === catalogEvent.id
                        ? "contained"
                        : "outlined"
                    }
                  >
                    {selectedEvent?.id === catalogEvent.id
                      ? "Selecionado"
                      : "Selecionar"}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}

        {createdEvent && (
          <Alert severity="success" sx={{ mt: 5 }}>
            {createdEvent.title} foi salvo como rascunho.
          </Alert>
        )}

        {selectedEvent && !createdEvent && (
          <EventSessionForm
            catalogEvent={selectedEvent}
            onCreated={(event) => {
              setCreatedEvent(event);
            }}
          />
        )}
      </Container>
    </Box>
  );
}
