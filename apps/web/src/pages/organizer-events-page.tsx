import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  cancelManagedEvent,
  listManagedEvents,
  type ManagedEvent,
  publishManagedEvent,
} from "../api/managed-events";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const statusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
} satisfies Record<ManagedEvent["status"], string>;

export function OrganizerEventsPage() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(
        `/login?returnTo=${encodeURIComponent("/organizer/events")}`,
        {
          replace: true,
        },
      );
      return;
    }

    let isActive = true;

    async function loadEvents(token: string) {
      try {
        const response = await listManagedEvents(token);

        if (isActive) {
          setEvents(response);
        }
      } catch {
        if (isActive) {
          setErrorMessage("Não foi possível carregar seus eventos.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadEvents(accessToken);

    return () => {
      isActive = false;
    };
  }, [navigate]);

  async function handlePublish(event: ManagedEvent) {
    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(
        `/login?returnTo=${encodeURIComponent("/organizer/events")}`,
        {
          replace: true,
        },
      );
      return;
    }

    setPendingEventId(event.id);
    setFeedbackMessage(null);
    setErrorMessage(null);

    try {
      const publishedEvent = await publishManagedEvent(event.id, accessToken);

      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === publishedEvent.id ? publishedEvent : currentEvent,
        ),
      );

      setFeedbackMessage(`${event.title} foi publicado.`);
    } catch {
      setErrorMessage("Não foi possível publicar o evento.");
    } finally {
      setPendingEventId(null);
    }
  }

  async function handleCancel(event: ManagedEvent) {
    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(
        `/login?returnTo=${encodeURIComponent("/organizer/events")}`,
        {
          replace: true,
        },
      );
      return;
    }

    setPendingEventId(event.id);
    setFeedbackMessage(null);
    setErrorMessage(null);

    try {
      const cancelledEvent = await cancelManagedEvent(event.id, accessToken);

      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === cancelledEvent.id ? cancelledEvent : currentEvent,
        ),
      );

      setFeedbackMessage(`${event.title} foi cancelado.`);
    } catch {
      setErrorMessage("Não foi possível cancelar o evento.");
    } finally {
      setPendingEventId(null);
    }
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          minHeight: "60vh",
          placeItems: "center",
        }}
      >
        <CircularProgress aria-label="Carregando eventos do organizador" />
      </Box>
    );
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
        <Stack
          spacing={3}
          sx={{
            alignItems: {
              xs: "flex-start",
              sm: "center",
            },
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            justifyContent: "space-between",
            mb: 5,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "primary.main",
                letterSpacing: "0.16em",
              }}
            >
              Organização
            </Typography>

            <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
              Meus eventos
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Acompanhe rascunhos, publicações e cancelamentos.
            </Typography>
          </Box>

          <Button
            component={Link}
            startIcon={<AddIcon />}
            to="/organizer/events/new"
            variant="contained"
          >
            Criar evento
          </Button>
        </Stack>

        {feedbackMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {feedbackMessage}
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        )}

        {!errorMessage && events.length === 0 && (
          <Alert severity="info">Você ainda não possui eventos.</Alert>
        )}

        <Stack spacing={3}>
          {events.map((event) => (
            <Paper
              elevation={0}
              key={event.id}
              square
              sx={{
                border: "1px solid",
                borderColor: "divider",
                p: { xs: 3, md: 4 },
              }}
            >
              <Stack
                spacing={3}
                sx={{
                  alignItems: {
                    xs: "flex-start",
                    md: "center",
                  },
                  flexDirection: {
                    xs: "column",
                    md: "row",
                  },
                  justifyContent: "space-between",
                }}
              >
                <Stack spacing={1}>
                  <Typography
                    color={
                      event.status === "CANCELLED"
                        ? "error.main"
                        : "primary.main"
                    }
                    sx={{
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                    variant="caption"
                  >
                    {statusLabels[event.status]}
                  </Typography>

                  <Typography component="h2" variant="h4">
                    {event.title}
                  </Typography>

                  <Typography color="text.secondary">
                    {dateFormatter.format(new Date(event.startsAt))}
                  </Typography>

                  <Typography>
                    {event.venue.name} — {event.venue.city}, {event.venue.state}
                  </Typography>

                  <Typography color="text.secondary">
                    {event.capacity} lugares ·{" "}
                    {currencyFormatter.format(event.priceInCents / 100)}
                  </Typography>
                </Stack>

                <Stack
                  spacing={2}
                  sx={{
                    flexDirection: {
                      xs: "column",
                      sm: "row",
                    },
                    width: {
                      xs: "100%",
                      md: "auto",
                    },
                  }}
                >
                  {event.status === "DRAFT" && (
                    <Button
                      aria-label={`Publicar ${event.title}`}
                      disabled={pendingEventId === event.id}
                      onClick={() => {
                        void handlePublish(event);
                      }}
                      type="button"
                      variant="contained"
                    >
                      Publicar
                    </Button>
                  )}

                  {event.status !== "CANCELLED" && (
                    <Button
                      aria-label={`Cancelar ${event.title}`}
                      disabled={pendingEventId === event.id}
                      onClick={() => {
                        void handleCancel(event);
                      }}
                      type="button"
                      variant="outlined"
                    >
                      Cancelar
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
