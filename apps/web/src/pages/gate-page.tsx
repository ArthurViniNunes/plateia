import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
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
import { useNavigate } from "react-router-dom";

import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { type FormEvent, useCallback, useState } from "react";

import { QrCameraReader } from "../components/qr-camera-reader";

import { type GateResult, validateTicket } from "../api/gate";

const resultContent = {
  INVALID: {
    severity: "error",
    title: "Ingresso inválido",
    message: "O código informado não corresponde a um ingresso válido.",
  },
  ALREADY_USED: {
    severity: "warning",
    title: "Ingresso já utilizado",
    message: "Este ingresso já foi validado anteriormente.",
  },
  WRONG_EVENT: {
    severity: "warning",
    title: "Evento incorreto",
    message: "Este ingresso pertence a outro evento.",
  },
} as const;

export function GatePage() {
  const navigate = useNavigate();

  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<GateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleCodeDetected = useCallback((detectedCode: string) => {
    setCode(detectedCode);
    setResult(null);
    setErrorMessage(null);
    setIsCameraOpen(false);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      void navigate(`/login?returnTo=${encodeURIComponent("/gate")}`, {
        replace: true,
      });
      return;
    }

    setResult(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const validation = await validateTicket({
        eventId,
        code,
        accessToken,
      });

      setResult(validation);
    } catch {
      setErrorMessage(
        "Não foi possível validar o ingresso. Confira os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const rejectedResult =
    result && result.result !== "VALID" ? resultContent[result.result] : null;

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
                <QrCodeScannerIcon color="primary" fontSize="large" />

                <Typography
                  variant="overline"
                  sx={{
                    color: "primary.main",
                    display: "block",
                    letterSpacing: "0.16em",
                    mt: 2,
                  }}
                >
                  Portaria Plateia
                </Typography>

                <Typography component="h1" variant="h3" sx={{ mt: 1 }}>
                  Validar ingresso
                </Typography>

                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Informe o evento e o código apresentado pelo visitante.
                </Typography>
              </Box>

              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

              {result?.result === "VALID" && (
                <Alert severity="success">
                  <Typography component="h2" sx={{ fontWeight: 700 }}>
                    Ingresso válido
                  </Typography>

                  <Typography sx={{ mt: 1 }}>
                    Assento {result.ticket.seat.rowLabel}
                    {result.ticket.seat.number}
                  </Typography>
                </Alert>
              )}

              {rejectedResult && (
                <Alert severity={rejectedResult.severity}>
                  <Typography component="h2" sx={{ fontWeight: 700 }}>
                    {rejectedResult.title}
                  </Typography>

                  <Typography sx={{ mt: 1 }}>
                    {rejectedResult.message}
                  </Typography>
                </Alert>
              )}

              <TextField
                disabled={isSubmitting}
                label="Identificador do evento"
                name="eventId"
                onChange={(event) => {
                  setEventId(event.target.value);
                }}
                required
                type="text"
                value={eventId}
              />

              <Button
                onClick={() => {
                  setIsCameraOpen((currentValue) => !currentValue);
                }}
                startIcon={
                  isCameraOpen ? <CloseIcon /> : <CameraAltOutlinedIcon />
                }
                type="button"
                variant="outlined"
              >
                {isCameraOpen ? "Fechar câmera" : "Ler QR pela câmera"}
              </Button>

              {isCameraOpen && (
                <QrCameraReader onDetected={handleCodeDetected} />
              )}

              <TextField
                disabled={isSubmitting}
                label="Código do ingresso"
                multiline
                name="code"
                onChange={(event) => {
                  setCode(event.target.value);
                }}
                required
                rows={3}
                value={code}
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
                      aria-label="Validando ingresso"
                      color="inherit"
                      size={20}
                      sx={{ mr: 1 }}
                    />
                    Validando
                  </>
                ) : (
                  "Validar ingresso"
                )}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
