import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
import { Link, useNavigate, useParams } from "react-router-dom";

import { getEvent, type EventDetails } from "../api/events";
import { createReservation } from "../api/reservations";
import {
  readAccessToken,
  readAuthenticatedUser,
} from "../session/auth-session";
import { saveCheckoutReservation } from "../session/checkout-reservation";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

export function EventDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [hasError, setHasError] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let isActive = true;

    async function loadEvent(id: string) {
      try {
        const response = await getEvent(id);

        if (isActive) {
          setEvent(response);
        }
      } catch {
        if (isActive) {
          setHasError(true);
        }
      }
    }

    void loadEvent(eventId);

    return () => {
      isActive = false;
    };
  }, [eventId]);

  function toggleSeat(seatId: string) {
    setSelectedSeatIds((currentSeatIds) => {
      if (currentSeatIds.includes(seatId)) {
        return currentSeatIds.filter(
          (currentSeatId) => currentSeatId !== seatId,
        );
      }

      if (currentSeatIds.length >= 4) {
        return currentSeatIds;
      }

      return [...currentSeatIds, seatId];
    });
  }

  async function continueToReservation() {
    if (!eventId || selectedSeatIds.length === 0 || isSubmitting) {
      return;
    }

    const authenticatedUser = readAuthenticatedUser();
    const accessToken = readAccessToken();

    if (!authenticatedUser || !accessToken) {
      sessionStorage.setItem(
        "plateia:pending-reservation",
        JSON.stringify({
          eventId,
          seatIds: selectedSeatIds,
        }),
      );

      const returnTo = `/events/${eventId}`;

      void navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (authenticatedUser.role !== "CUSTOMER") {
      setReservationError(
        "Somente clientes podem reservar assentos para este evento.",
      );
      return;
    }

    setReservationError(null);
    setIsSubmitting(true);

    try {
      const reservation = await createReservation({
        eventId,
        seatIds: selectedSeatIds,
        accessToken,
      });

      saveCheckoutReservation(reservation);
      sessionStorage.removeItem("plateia:pending-reservation");

      void navigate(`/checkout/${reservation.id}`);
    } catch {
      setReservationError(
        "Não foi possível reservar os assentos. Verifique a disponibilidade e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!eventId || hasError) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error">Não foi possível carregar este evento.</Alert>
      </Container>
    );
  }

  if (!event) {
    return (
      <Box
        sx={{
          display: "grid",
          minHeight: "60vh",
          placeItems: "center",
        }}
      >
        <CircularProgress aria-label="Carregando evento" />
      </Box>
    );
  }

  return (
    <Box component="main">
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          py: { xs: 5, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Button
            component={Link}
            to="/"
            startIcon={<ArrowBackIcon />}
            sx={{
              color: "secondary.main",
              mb: 4,
            }}
          >
            Voltar à agenda
          </Button>

          <Typography
            variant="overline"
            sx={{
              color: "secondary.main",
              letterSpacing: "0.16em",
            }}
          >
            {event.classification ?? "Evento"}
          </Typography>

          <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
            {event.title}
          </Typography>

          <Typography
            sx={{
              color: "rgba(255,255,255,0.72)",
              mt: 2,
            }}
          >
            {dateFormatter.format(new Date(event.startsAt))}
          </Typography>

          <Typography sx={{ color: "rgba(255,255,255,0.72)" }}>
            {event.venue.name} — {event.venue.city}, {event.venue.state}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 5, md: 8 },
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1fr) 300px",
            },
          }}
        >
          <Stack spacing={4}>
            <Box>
              <Typography component="h2" variant="h4">
                Escolha seu lugar
              </Typography>

              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Selecione até quatro assentos para continuar.
              </Typography>
            </Box>

            <Box
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                letterSpacing: "0.2em",
                py: 1.5,
                textAlign: "center",
              }}
            >
              PALCO
            </Box>

            <Stack spacing={3}>
              {event.rows.map((row) => (
                <Box
                  key={row.label}
                  sx={{
                    alignItems: "center",
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: "32px minmax(0, 1fr)",
                  }}
                >
                  <Typography
                    aria-label={`Fileira ${row.label}`}
                    sx={{ fontWeight: 700 }}
                  >
                    {row.label}
                  </Typography>

                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    {row.seats.map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.id);

                      return (
                        <Button
                          aria-label={`Assento ${row.label}${seat.number} ${
                            isSelected ? "selecionado" : "disponível"
                          }`}
                          aria-pressed={isSelected}
                          key={seat.id}
                          onClick={() => {
                            toggleSeat(seat.id);
                          }}
                          type="button"
                          variant={isSelected ? "contained" : "outlined"}
                          sx={{
                            height: 44,
                            minWidth: 44,
                            width: 44,
                          }}
                        >
                          {seat.number}
                        </Button>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Stack>

          <Box
            component="aside"
            sx={{
              alignSelf: "start",
              border: "1px solid",
              borderColor: "divider",
              p: 3,
            }}
          >
            <Typography variant="overline">Sua seleção</Typography>

            <Typography variant="h5" sx={{ mt: 1 }}>
              {selectedSeatIds.length === 0
                ? "Nenhum assento selecionado"
                : `${selectedSeatIds.length} ${
                    selectedSeatIds.length === 1
                      ? "assento selecionado"
                      : "assentos selecionados"
                  }`}
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Por assento: {currencyFormatter.format(event.priceInCents / 100)}
            </Typography>

            <Typography sx={{ fontWeight: 700, mt: 1 }}>
              Total:{" "}
              {currencyFormatter.format(
                (event.priceInCents * selectedSeatIds.length) / 100,
              )}
            </Typography>

            {reservationError && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {reservationError}
              </Alert>
            )}

            <Button
              disabled={selectedSeatIds.length === 0 || isSubmitting}
              fullWidth
              onClick={() => {
                void continueToReservation();
              }}
              sx={{ mt: 3 }}
              type="button"
              variant="contained"
            >
              {isSubmitting ? (
                <>
                  <CircularProgress
                    aria-label="Criando reserva"
                    color="inherit"
                    size={20}
                    sx={{ mr: 1 }}
                  />
                  Reservando
                </>
              ) : (
                "Continuar para reservar"
              )}
            </Button>

            <Typography
              color="text.secondary"
              variant="caption"
              sx={{
                display: "block",
                mt: 2,
              }}
            >
              Os lugares serão bloqueados por dez minutos após a reserva.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
