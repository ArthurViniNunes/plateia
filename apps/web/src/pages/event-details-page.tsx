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
          overflow: "hidden",
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: event.imageUrl
                ? "minmax(0, 1.05fr) minmax(360px, .95fr)"
                : "1fr",
            },
            p: "0 !important",
          }}
        >
          <Box sx={{ p: { xs: 3, sm: 6, md: 8 } }}>
            <Button
              component={Link}
              to="/"
              startIcon={<ArrowBackIcon />}
              sx={{
                color: "common.white",
                mb: { xs: 5, md: 8 },
                px: 0,
              }}
            >
              Voltar à agenda
            </Button>

            <Typography sx={{ color: "secondary.main", fontWeight: 700 }}>
              {event.classification ?? "Evento"}
            </Typography>

            <Typography
              className="poster-reveal"
              component="h1"
              variant="h2"
              sx={{ maxWidth: 760, mt: 2 }}
            >
              {event.title}
            </Typography>

            <Box
              sx={{
                borderLeft: "4px solid",
                borderColor: "secondary.main",
                mt: 5,
                pl: 2,
              }}
            >
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {dateFormatter.format(new Date(event.startsAt))}
              </Typography>
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.76)",
                  mt: 0.5,
                }}
              >
                {event.venue.name} — {event.venue.city}, {event.venue.state}
              </Typography>
            </Box>
          </Box>

          {event.imageUrl && (
            <Box
              component="img"
              src={event.imageUrl}
              alt=""
              sx={{
                height: { xs: 300, md: "100%" },
                minHeight: { md: 520 },
                objectFit: "cover",
                width: "100%",
              }}
            />
          )}
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

              <Typography color="text.secondary" sx={{ mt: 2 }}>
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
                bgcolor: "text.primary",
                clipPath: "polygon(3% 0, 97% 0, 100% 100%, 0 100%)",
                color: "common.white",
                fontFamily: '"Archivo Black", sans-serif',
                letterSpacing: "0.08em",
                mx: { xs: 1, sm: 6 },
                py: 2,
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
              bgcolor: "secondary.main",
              border: "2px solid",
              borderColor: "text.primary",
              boxShadow: "10px 10px 0 #0a0a0a",
              p: { xs: 3, md: 4 },
              position: { md: "sticky" },
              top: { md: 96 },
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>Sua seleção</Typography>

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
