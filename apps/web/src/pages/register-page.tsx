import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { EmailAlreadyRegisteredError, register } from "../api/auth";
import { AccessShell } from "../components/access-shell";

function getSafeReturnTo(returnTo: string | null) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }

  return returnTo;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const loginPath = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await register({
        name,
        email,
        password,
      });

      void navigate(loginPath, {
        replace: true,
      });
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyRegisteredError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "Não foi possível criar sua conta agora. Tente novamente.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AccessShell>
      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ color: "primary.main", fontWeight: 700 }}>
              Primeira fila começa aqui
            </Typography>

            <Typography component="h1" variant="h3" sx={{ mt: 2 }}>
              Crie sua conta
            </Typography>

            <Typography color="text.secondary" sx={{ maxWidth: 460, mt: 2 }}>
              Cadastre-se para reservar seus lugares e acessar seus ingressos.
            </Typography>
          </Box>

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <TextField
            autoComplete="name"
            disabled={isSubmitting}
            label="Nome completo"
            name="name"
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
            type="text"
            value={name}
          />

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
            autoComplete="new-password"
            disabled={isSubmitting}
            helperText="Use entre 8 caracteres e 72 bytes."
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
                  aria-label="Criando conta"
                  color="inherit"
                  size={20}
                  sx={{ mr: 1 }}
                />
                Criando conta
              </>
            ) : (
              "Criar conta"
            )}
          </Button>

          <Button component={Link} to={loginPath} variant="text">
            Já tenho uma conta
          </Button>
        </Stack>
      </Box>
    </AccessShell>
  );
}
