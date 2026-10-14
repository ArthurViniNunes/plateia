import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import {
  Alert,
  Box,
  Button,
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

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  timeZone: "America/Fortaleza",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "America/Fortaleza",
});

function EventArtwork({ event }: { event: PublicEvent }) {
  if (event.imageUrl) {
    return (
      <Box
        component="img"
        src={event.imageUrl}
        alt=""
        sx={{
          height: "100%",
          objectFit: "cover",
          transition: "transform 450ms cubic-bezier(.2,.7,.2,1)",
          width: "100%",
        }}
      />
    );
  }

  return (
    <Box
      aria-hidden="true"
      sx={{
        bgcolor: "primary.main",
        display: "grid",
        height: "100%",
        overflow: "hidden",
        placeItems: "center",
        position: "relative",
      }}
    >
      <Box
        sx={{
          bgcolor: "secondary.main",
          borderRadius: "50%",
          height: "62%",
          width: "62%",
        }}
      />
      <Typography
        sx={{
          color: "common.white",
          fontFamily: '"Archivo Black", sans-serif',
          fontSize: "clamp(3rem, 9vw, 7rem)",
          left: "50%",
          letterSpacing: "-0.08em",
          lineHeight: 0.8,
          position: "absolute",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-8deg)",
        }}
      >
        P!
      </Typography>
    </Box>
  );
}

function EventCard({
  event,
  featured = false,
}: {
  event: PublicEvent;
  featured?: boolean;
}) {
  const eventDate = new Date(event.startsAt);

  return (
    <Box
      className="poster-reveal"
      component={Link}
      to={`/events/${event.id}`}
      sx={{
        bgcolor: "background.paper",
        border: "2px solid",
        borderColor: "text.primary",
        color: "text.primary",
        display: "grid",
        gridTemplateColumns: featured
          ? { xs: "1fr", md: "minmax(0, 1.7fr) minmax(300px, 0.8fr)" }
          : "1fr",
        minHeight: featured ? { md: 520 } : 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        "&:focus-visible": {
          outline: "4px solid",
          outlineColor: "primary.main",
          outlineOffset: 4,
        },
        "&:hover img": { transform: "scale(1.025)" },
        "&:hover .event-action": {
          bgcolor: "text.primary",
          color: "common.white",
        },
      }}
    >
      <Box
        sx={{
          minHeight: featured ? { xs: 280, md: 520 } : 240,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <EventArtwork event={event} />
        {featured && (
          <Box
            sx={{
              bgcolor: "secondary.main",
              bottom: 0,
              color: "secondary.contrastText",
              fontWeight: 700,
              left: 0,
              px: 2,
              py: 1,
              position: "absolute",
            }}
          >
            Escolha da Plateia
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          p: featured ? { xs: 3, sm: 4, md: 5 } : { xs: 3, sm: 3.5 },
        }}
      >
        <Box
          sx={{
            alignItems: "flex-start",
            display: "flex",
            gap: 2,
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ color: "primary.main", fontWeight: 700 }}>
            {event.classification ?? "Evento"}
          </Typography>
          <Box
            sx={{
              borderLeft: "2px solid",
              borderColor: "text.primary",
              flex: "0 0 auto",
              pl: 1.5,
              textAlign: "center",
            }}
          >
            <Typography
              sx={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: featured ? "2.35rem" : "1.85rem",
                letterSpacing: "-0.05em",
                lineHeight: 0.85,
              }}
            >
              {dayFormatter.format(eventDate)}
            </Typography>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {monthFormatter.format(eventDate).replace(".", "")}
            </Typography>
          </Box>
        </Box>

        <Typography
          component="h2"
          variant={featured ? "h3" : "h5"}
          sx={{ mt: featured ? 5 : 3 }}
        >
          {event.title}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <Typography color="text.secondary">
            {dateFormatter.format(eventDate)}
          </Typography>
          <Typography color="text.secondary">
            {event.venue.city}, {event.venue.state}
          </Typography>
        </Box>

        <Box
          sx={{
            alignItems: "flex-end",
            display: "flex",
            gap: 2,
            justifyContent: "space-between",
            mt: "auto",
            pt: featured ? 5 : 4,
          }}
        >
          <Box>
            <Typography color="text.secondary" variant="caption">
              a partir de
            </Typography>
            <Typography variant="h6">
              {currencyFormatter.format(event.priceInCents / 100)}
            </Typography>
          </Box>
          <Box
            className="event-action"
            sx={{
              alignItems: "center",
              border: "2px solid",
              display: "flex",
              height: 48,
              justifyContent: "center",
              transition: "background-color 160ms ease, color 160ms ease",
              width: 48,
            }}
          >
            <ArrowOutwardIcon aria-hidden="true" />
          </Box>
        </Box>
      </Box>
    </Box>
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
        if (isActive) setEvents(response.data);
      } catch {
        if (isActive) setHasError(true);
      } finally {
        if (isActive) setIsLoading(false);
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
          bgcolor: "secondary.main",
          borderBottom: "2px solid",
          color: "secondary.contrastText",
          minHeight: { md: "calc(100vh - 72px)" },
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Container
          className="poster-reveal"
          maxWidth={false}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1.35fr) minmax(360px, .65fr)",
            },
            minHeight: { md: "calc(100vh - 118px)" },
            px: { xs: 2.5, sm: 6, md: 8 },
          }}
        >
          <Box
            sx={{
              alignItems: "flex-start",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth: 980,
              py: { xs: 8, md: 10 },
              pr: { md: 6 },
              position: "relative",
              zIndex: 1,
            }}
          >
            <Typography
              sx={{
                alignItems: "center",
                display: "flex",
                fontWeight: 700,
                gap: 1.5,
                mb: { xs: 3, md: 5 },
                "&::before": {
                  bgcolor: "primary.main",
                  borderRadius: "50%",
                  content: '""',
                  height: 12,
                  width: 12,
                },
              }}
            >
              Fortaleza em movimento
            </Typography>

            <Typography component="h1" variant="h1">
              Descubra o que ocupa a cidade
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: "1.1rem", md: "1.35rem" },
                fontWeight: 500,
                lineHeight: 1.4,
                maxWidth: 560,
                mt: { xs: 4, md: 5 },
              }}
            >
              Shows, encontros e experiências escolhidos para tirar seus dias do
              automático.
            </Typography>

            <Button
              component="a"
              href="#agenda"
              size="large"
              variant="contained"
              sx={{
                bgcolor: "text.primary",
                borderColor: "text.primary",
                color: "common.white",
                mt: 4,
                "&:hover": {
                  bgcolor: "primary.main",
                  borderColor: "primary.main",
                },
              }}
            >
              Ver a agenda
            </Button>
          </Box>

          <Box
            aria-hidden="true"
            sx={{
              alignItems: "center",
              bgcolor: "primary.main",
              clipPath: {
                xs: "polygon(8% 0, 100% 0, 100% 100%, 0 100%)",
                md: "polygon(24% 0, 100% 0, 100% 100%, 0 100%)",
              },
              display: { xs: "none", sm: "flex" },
              justifyContent: "center",
              minHeight: { xs: 310, md: "auto" },
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                border: "3px solid white",
                borderRadius: "50%",
                height: "min(32vw, 420px)",
                opacity: 0.9,
                position: "absolute",
                width: "min(32vw, 420px)",
              }}
            />
            <Typography
              sx={{
                color: "common.white",
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: "clamp(4rem, 8vw, 9rem)",
                letterSpacing: "-0.08em",
                lineHeight: 0.72,
                position: "relative",
                textAlign: "center",
                transform: "rotate(-8deg)",
              }}
            >
              AO
              <br />
              VIVO
            </Typography>
          </Box>
        </Container>

        <Box
          sx={{
            bgcolor: "text.primary",
            color: "common.white",
            display: "flex",
            gap: 4,
            overflow: "hidden",
            px: 3,
            py: 1.5,
            whiteSpace: "nowrap",
          }}
        >
          {["Música", "Teatro", "Ideias", "Encontros", "Experiências"].map(
            (item) => (
              <Typography
                key={item}
                sx={{
                  alignItems: "center",
                  display: "flex",
                  fontWeight: 700,
                  gap: 4,
                }}
              >
                {item}
                <Box component="span" sx={{ color: "secondary.main" }}>
                  ●
                </Box>
              </Typography>
            ),
          )}
        </Box>
      </Box>

      <Container id="agenda" maxWidth={false} sx={{ py: { xs: 7, md: 12 } }}>
        <Box
          sx={{
            alignItems: { md: "end" },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            justifyContent: "space-between",
            mb: { xs: 5, md: 7 },
          }}
        >
          <Typography component="h2" variant="h2" sx={{ maxWidth: 720 }}>
            Tem lugar para você
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            Uma agenda curta de propósito: menos rolagem, mais vontade de sair.
            Escolha a próxima história que você vai contar.
          </Typography>
        </Box>

        {isLoading && (
          <Box sx={{ display: "grid", minHeight: 320, placeItems: "center" }}>
            <CircularProgress aria-label="Carregando eventos" />
          </Box>
        )}

        {hasError && (
          <Alert severity="error">
            Não foi possível carregar os eventos. Tente novamente.
          </Alert>
        )}

        {!isLoading && !hasError && events.length === 0 && (
          <Box sx={{ borderBlock: "2px solid", py: 6 }}>
            <Typography variant="h5">A agenda está respirando.</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Nenhum evento publicado no momento. Volte em breve.
            </Typography>
          </Box>
        )}

        {!isLoading && !hasError && events.length > 0 && (
          <Stack spacing={{ xs: 3, md: 4 }}>
            <EventCard event={events[0]} featured />
            {events.length > 1 && (
              <Box
                sx={{
                  display: "grid",
                  gap: { xs: 3, md: 4 },
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {events.slice(1).map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </Box>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
