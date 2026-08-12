import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
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

import { listTickets, type Ticket } from "../api/tickets";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const statusLabels = {
  VALID: "Válido",
  USED: "Utilizado",
  CANCELLED: "Cancelado",
} satisfies Record<Ticket["status"], string>;

const statusColors = {
  VALID: "success.main",
  USED: "text.secondary",
  CANCELLED: "error.main",
} satisfies Record<Ticket["status"], string>;

export function TicketsPage() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(`/login?returnTo=${encodeURIComponent("/tickets")}`, {
        replace: true,
      });
      return;
    }

    let isActive = true;

    async function loadTickets(token: string) {
      try {
        const response = await listTickets(token);

        if (isActive) {
          setTickets(response);
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

    void loadTickets(accessToken);

    return () => {
      isActive = false;
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          minHeight: "60vh",
          placeItems: "center",
        }}
      >
        <CircularProgress aria-label="Carregando ingressos" />
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
      <Container maxWidth="md">
        <Typography
          variant="overline"
          sx={{
            color: "primary.main",
            letterSpacing: "0.16em",
          }}
        >
          Plateia
        </Typography>

        <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
          Meus ingressos
        </Typography>

        <Typography color="text.secondary" sx={{ mt: 2, mb: 5 }}>
          Seus lugares, códigos de acesso e links compartilháveis.
        </Typography>

        {hasError && (
          <Alert severity="error">
            Não foi possível carregar seus ingressos.
          </Alert>
        )}

        {!hasError && tickets.length === 0 && (
          <Alert severity="info">Você ainda não possui ingressos.</Alert>
        )}

        <Stack spacing={3}>
          {tickets.map((ticket) => (
            <Paper
              elevation={0}
              key={ticket.id}
              square
              sx={{
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "12px minmax(0, 1fr)",
                  },
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    bgcolor:
                      ticket.status === "VALID" ? "secondary.main" : "divider",
                  }}
                />

                <Box sx={{ p: { xs: 3, sm: 4 } }}>
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
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography
                        sx={{
                          color: statusColors[ticket.status],
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}
                        variant="caption"
                      >
                        {statusLabels[ticket.status]}
                      </Typography>

                      <Typography component="h2" variant="h4">
                        {ticket.event.title}
                      </Typography>

                      <Typography color="text.secondary">
                        {dateFormatter.format(new Date(ticket.event.startsAt))}
                      </Typography>

                      <Typography>{ticket.event.venue.name}</Typography>

                      <Typography color="text.secondary">
                        {ticket.event.venue.city}, {ticket.event.venue.state}
                      </Typography>

                      <Typography sx={{ fontWeight: 700 }}>
                        Assento {ticket.seat.rowLabel}
                        {ticket.seat.number}
                      </Typography>
                    </Stack>

                    <Button
                      aria-label={`Abrir ingresso ${ticket.event.title}, assento ${ticket.seat.rowLabel}${ticket.seat.number}`}
                      component={Link}
                      startIcon={<ConfirmationNumberOutlinedIcon />}
                      to={ticket.sharePath}
                      variant="contained"
                    >
                      Abrir ingresso
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
