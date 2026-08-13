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
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getEvent, type EventDetails } from "../api/events";
import { createReservation, SeatsUnavailableError } from "../api/reservations";
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

const seatStatusLabels = {
  AVAILABLE: "disponível",
  BLOCKED: "temporariamente reservado",
  SOLD: "vendido",
} as const;

export function EventDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [hasError, setHasError] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  const applyEventUpdate = useCallback((updatedEvent: EventDetails) => {
    setEvent(updatedEvent);

    const availableSeatIds = new Set(
      updatedEvent.rows.flatMap((row) =>
        row.seats
          .filter((seat) => seat.status === "AVAILABLE")
          .map((seat) => seat.id),
      ),
    );

    setSelectedSeatIds((currentSeatIds) =>
      currentSeatIds.filter((seatId) => availableSeatIds.has(seatId)),
    );
  }, []);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let isActive = true;
    let hasLoadedEvent = false;
    let requestInFlight = false;

    async function loadEvent(id: string) {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await getEvent(id);

        if (!isActive) {
          return;
        }

        hasLoadedEvent = true;
        setHasError(false);

        applyEventUpdate(response);
      } catch {
        if (isActive && !hasLoadedEvent) {
          setHasError(true);
        }
      } finally {
        requestInFlight = false;
      }
    }

    void loadEvent(eventId);

    const refreshInterval = window.setInterval(() => {
      void loadEvent(eventId);
    }, 10_000);

    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, [eventId, applyEventUpdate]);

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
    } catch (error: unknown) {
      if (error instanceof SeatsUnavailableError) {
        try {
          const updatedEvent = await getEvent(eventId);

          applyEventUpdate(updatedEvent);
        } catch {
          // A mensagem de conflito permanece útil mesmo se a atualização falhar.
        }

        setReservationError(
          "Um dos assentos selecionados acabou de ficar indisponível. Escolha novamente.",
        );
        return;
      }

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

              <Stack
                aria-label="Legenda dos assentos"
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ mt: 2 }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      border: "1px solid",
                      borderColor: "primary.main",
                      height: 16,
                      width: 16,
                    }}
                  />
                  <Typography variant="caption">Disponível</Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      bgcolor: "action.hover",
                      border: "1px solid",
                      borderColor: "divider",
                      height: 16,
                      width: 16,
                    }}
                  />
                  <Typography variant="caption">
                    Temporariamente reservado
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      bgcolor: "primary.main",
                      height: 16,
                      opacity: 0.45,
                      width: 16,
                    }}
                  />
                  <Typography variant="caption">Vendido</Typography>
                </Stack>
              </Stack>
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
                      const isAvailable = seat.status === "AVAILABLE";
                      const isSelected =
                        isAvailable && selectedSeatIds.includes(seat.id);

                      return (
                        <Button
                          aria-label={`Assento ${row.label}${seat.number} ${
                            isSelected
                              ? "selecionado"
                              : seatStatusLabels[seat.status]
                          }`}
                          aria-pressed={isSelected}
                          disabled={!isAvailable}
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
                            ...(seat.status === "BLOCKED" && {
                              "&.Mui-disabled": {
                                bgcolor: "action.hover",
                                borderColor: "divider",
                                color: "text.secondary",
                              },
                            }),
                            ...(seat.status === "SOLD" && {
                              "&.Mui-disabled": {
                                bgcolor: "primary.main",
                                borderColor: "primary.main",
                                color: "primary.contrastText",
                                opacity: 0.45,
                              },
                            }),
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
