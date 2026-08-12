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
import { useNavigate, useSearchParams } from "react-router-dom";

import { InvalidCredentialsError, login } from "../api/auth";
import { createReservation } from "../api/reservations";
import {
  clearPendingReservation,
  readPendingReservation,
} from "../session/pending-reservation";
import { saveCheckoutReservation } from "../session/checkout-reservation";

function getSafeReturnTo(returnTo: string | null) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const authentication = await login({
        email,
        password,
      });

      sessionStorage.setItem("plateia:access-token", authentication.token);

      const pendingReservation = readPendingReservation();

      if (pendingReservation) {
        try {
          const reservation = await createReservation({
            eventId: pendingReservation.eventId,
            seatIds: pendingReservation.seatIds,
            accessToken: authentication.token,
          });

          saveCheckoutReservation(reservation);
          clearPendingReservation();

          void navigate(`/checkout/${reservation.id}`, {
            replace: true,
          });

          return;
        } catch {
          setErrorMessage(
            "Login realizado, mas não foi possível reservar os assentos. Tente novamente.",
          );

          return;
        }
      }

      const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

      void navigate(returnTo, {
        replace: true,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Não foi possível entrar agora. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        bgcolor: "background.default",
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        py: 6,
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
          <Box
            component="form"
            onSubmit={(event) => {
              void handleSubmit(event);
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
                  Plateia
                </Typography>

                <Typography component="h1" variant="h3" sx={{ mt: 1 }}>
                  Entre para continuar
                </Typography>

                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Sua seleção está guardada. Entre para reservar os lugares.
                </Typography>
              </Box>

              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

              <TextField
                autoComplete="email"
                disabled={isSubmitting}
                label="E-mail"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
                type="email"
                value={email}
              />

              <TextField
                autoComplete="current-password"
                disabled={isSubmitting}
                label="Senha"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
                type="password"
                value={password}
              />

              <Button
                disabled={isSubmitting}
                size="large"
                type="submit"
                variant="contained"
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress
                      aria-label="Autenticando"
                      color="inherit"
                      size={20}
                      sx={{ mr: 1 }}
                    />
                    Entrando
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
