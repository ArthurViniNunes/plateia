import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useParams } from "react-router-dom";

import { getSharedTicket, type Ticket } from "../api/tickets";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const statusContent = {
  VALID: {
    label: "Ingresso válido",
    color: "success.main",
    message: "Apresente este QR Code na entrada do evento.",
  },
  USED: {
    label: "Ingresso utilizado",
    color: "text.secondary",
    message: "Este ingresso já foi validado na portaria.",
  },
  CANCELLED: {
    label: "Ingresso cancelado",
    color: "error.main",
    message: "Este ingresso não é válido porque o evento foi cancelado.",
  },
} satisfies Record<
  Ticket["status"],
  {
    label: string;
    color: string;
    message: string;
  }
>;

export function SharedTicketPage() {
  const { code } = useParams();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }

    let isActive = true;

    async function loadTicket(ticketCode: string) {
      try {
        const response = await getSharedTicket(ticketCode);

        if (isActive) {
          setTicket(response);
        }
      } catch {
        if (isActive) {
          setHasError(true);
        }
      }
    }

    void loadTicket(code);

    return () => {
      isActive = false;
    };
  }, [code]);

  if (!code || hasError) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">
          Não foi possível encontrar este ingresso.
        </Alert>
      </Container>
    );
  }

  if (!ticket) {
    return (
      <Box
        sx={{
          display: "grid",
          minHeight: "60vh",
          placeItems: "center",
        }}
      >
        <CircularProgress aria-label="Carregando ingresso" />
      </Box>
    );
  }

  const status = statusContent[ticket.status];

  return (
    <Box
      component="main"
      sx={{
        bgcolor: "primary.main",
        minHeight: "100vh",
        py: { xs: 5, md: 8 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          square
          sx={{
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              bgcolor: "secondary.main",
              height: 12,
            }}
          />

          <Stack spacing={4} sx={{ p: { xs: 3, sm: 5 } }}>
            <Box>
              <Stack
                spacing={1}
                sx={{
                  alignItems: "flex-start",
                  flexDirection: "row",
                }}
              >
                <ConfirmationNumberOutlinedIcon color="primary" />

                <Typography
                  variant="overline"
                  sx={{
                    color: "primary.main",
                    letterSpacing: "0.16em",
                  }}
                >
                  Plateia
                </Typography>
              </Stack>

              <Typography component="h1" variant="h3" sx={{ mt: 2 }}>
                {ticket.event.title}
              </Typography>

              <Typography
                sx={{
                  color: status.color,
                  fontWeight: 700,
                  mt: 2,
                }}
              >
                {status.label}
              </Typography>
            </Box>

            <Box
              aria-label="QR Code do ingresso"
              role="img"
              sx={{
                alignSelf: "center",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                display: "grid",
                p: 2,
                placeItems: "center",
              }}
            >
              <QRCodeSVG
                aria-hidden="true"
                level="H"
                size={220}
                value={ticket.code}
              />
            </Box>

            <Typography color="text.secondary" sx={{ textAlign: "center" }}>
              {status.message}
            </Typography>

            <Box
              sx={{
                borderBlock: "1px dashed",
                borderColor: "divider",
                py: 3,
              }}
            >
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>
                  {dateFormatter.format(new Date(ticket.event.startsAt))}
                </Typography>

                <Typography>{ticket.event.venue.name}</Typography>

                <Typography color="text.secondary">
                  {ticket.event.venue.city}, {ticket.event.venue.state}
                </Typography>

                <Typography variant="h5" sx={{ mt: 2 }}>
                  Assento {ticket.seat.rowLabel}
                  {ticket.seat.number}
                </Typography>
              </Stack>
            </Box>

            <Typography
              color="text.secondary"
              variant="caption"
              sx={{
                overflowWrap: "anywhere",
                textAlign: "center",
              }}
            >
              Código: {ticket.code}
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
