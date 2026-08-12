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
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { type PaymentOutcome, processPayment } from "../api/payments";
import {
  clearCheckoutReservation,
  readCheckoutReservation,
} from "../session/checkout-reservation";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatSeats(
  seats: Array<{
    rowLabel: string;
    number: number;
  }>,
) {
  const labels = seats.map(({ rowLabel, number }) => `${rowLabel}${number}`);

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

export function CheckoutPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();

  const [reservation] = useState(() => readCheckoutReservation());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidReservation =
    reservationId && reservation && reservation.id === reservationId;

  async function handlePayment(outcome: PaymentOutcome) {
    if (!reservationId || !isValidReservation) {
      return;
    }

    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(
        `/login?returnTo=${encodeURIComponent(`/checkout/${reservationId}`)}`,
        {
          replace: true,
        },
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payment = await processPayment({
        reservationId,
        accessToken,
        outcome,
      });

      clearCheckoutReservation();

      if (payment.status === "PAID") {
        void navigate("/tickets", {
          replace: true,
        });
        return;
      }

      setErrorMessage("Pagamento recusado. Os assentos foram liberados.");
    } catch {
      setErrorMessage(
        "Não foi possível processar o pagamento. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isValidReservation) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">Não foi possível encontrar esta reserva.</Alert>
      </Container>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        bgcolor: "background.default",
        minHeight: "100vh",
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          square
          sx={{
            border: "1px solid",
            borderColor: "divider",
            p: { xs: 3, sm: 5 },
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: "primary.main",
                  letterSpacing: "0.16em",
                }}
              >
                Checkout
              </Typography>

              <Typography component="h1" variant="h3" sx={{ mt: 1 }}>
                Confirme seu pagamento
              </Typography>

              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Esta é uma cobrança simulada. Nenhum valor real será
                movimentado.
              </Typography>
            </Box>

            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <Box
              sx={{
                bgcolor: "background.paper",
                borderBlock: "1px solid",
                borderColor: "divider",
                py: 3,
              }}
            >
              <Typography>Assentos {formatSeats(reservation.seats)}</Typography>

              <Typography sx={{ fontWeight: 700, mt: 1 }}>
                Total:{" "}
                {currencyFormatter.format(reservation.totalInCents / 100)}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                disabled={isSubmitting}
                fullWidth
                onClick={() => {
                  void handlePayment("DECLINED");
                }}
                size="large"
                type="button"
                variant="outlined"
              >
                Recusar pagamento
              </Button>

              <Button
                disabled={isSubmitting}
                fullWidth
                onClick={() => {
                  void handlePayment("APPROVED");
                }}
                size="large"
                type="button"
                variant="contained"
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress
                      aria-label="Processando pagamento"
                      color="inherit"
                      size={20}
                      sx={{ mr: 1 }}
                    />
                    Processando
                  </>
                ) : (
                  "Aprovar pagamento"
                )}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
