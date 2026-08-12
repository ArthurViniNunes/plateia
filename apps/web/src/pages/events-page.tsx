import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listEvents, type PublicEvent } from "../api/events";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

function EventCard({ event }: { event: PublicEvent }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0,
        height: "100%",
      }}
    >
      <Link
        to={`/events/${event.id}`}
        style={{
          color: "inherit",
          display: "block",
          height: "100%",
          textDecoration: "none",
        }}
      >
        <CardActionArea component="div" sx={{ height: "100%" }}>
          {event.imageUrl && (
            <CardMedia
              component="img"
              height="220"
              image={event.imageUrl}
              alt=""
              sx={{ objectFit: "cover" }}
            />
          )}

          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box
                sx={{
                  alignItems: "center",
                  display: "flex",
                  gap: 2,
                  justifyContent: "space-between",
                }}
              >
                <Chip
                  label={event.classification ?? "Evento"}
                  size="small"
                  sx={{ borderRadius: 0 }}
                />

                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {event.capacity} lugares
                </Typography>
              </Box>

              <Typography component="h2" variant="h5">
                {event.title}
              </Typography>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  {dateFormatter.format(new Date(event.startsAt))}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {event.venue.city}, {event.venue.state}
                </Typography>
              </Box>

              <Typography variant="h6">
                {currencyFormatter.format(event.priceInCents / 100)}
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Link>
    </Card>
  );
}

export function EventsPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadEvents() {
      try {
        const response = await listEvents();

        if (isActive) {
          setEvents(response.data);
        }
      } catch {
        if (isActive) {
          setHasError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <Box component="main">
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="overline"
            sx={{
              color: "secondary.main",
              letterSpacing: "0.2em",
            }}
          >
            Plateia — agenda cultural
          </Typography>

          <Typography
            component="h1"
            variant="h2"
            sx={{
              maxWidth: 760,
              mt: 2,
            }}
          >
            Descubra o que ocupa a cidade
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: "rgba(255,255,255,0.72)",
              fontWeight: 400,
              maxWidth: 600,
              mt: 3,
            }}
          >
            Shows, encontros e experiências para sair da rotina e entrar em
            cena.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Stack spacing={4}>
          <Box>
            <Typography component="h2" variant="h4">
              Próximos eventos
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Escolha a experiência. O seu lugar espera por você.
            </Typography>
          </Box>

          {isLoading && (
            <Box
              sx={{
                display: "grid",
                minHeight: 240,
                placeItems: "center",
              }}
            >
              <CircularProgress aria-label="Carregando eventos" />
            </Box>
          )}

          {hasError && (
            <Alert severity="error">
              Não foi possível carregar os eventos. Tente novamente.
            </Alert>
          )}

          {!isLoading && !hasError && events.length === 0 && (
            <Typography color="text.secondary">
              Nenhum evento publicado no momento.
            </Typography>
          )}

          {!isLoading && !hasError && events.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gap: 3,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {events.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
