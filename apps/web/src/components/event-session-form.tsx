import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useState } from "react";

import { createEvent, type CreateEventInput } from "../api/create-event";
import type { CatalogEvent } from "../api/catalog";
import type { ManagedEvent } from "../api/managed-events";

interface EditableRow {
  id: string;
  label: string;
  seatCount: string;
}

interface EventSessionFormProps {
  catalogEvent: CatalogEvent;
  onCreated: (event: ManagedEvent) => void;
}

function createEmptyRow(): EditableRow {
  return {
    id: crypto.randomUUID(),
    label: "",
    seatCount: "",
  };
}

export function EventSessionForm({
  catalogEvent,
  onCreated,
}: EventSessionFormProps) {
  const [startsAt, setStartsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [price, setPrice] = useState("");
  const [rows, setRows] = useState<EditableRow[]>([createEmptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateRow(
    rowId: string,
    field: "label" | "seatCount",
    value: string,
  ) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function removeRow(rowId: string) {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accessToken = sessionStorage.getItem("plateia:access-token");

    if (!accessToken) {
      setErrorMessage("Sua sessão expirou. Entre novamente.");
      return;
    }

    const priceInCents = Math.round(Number.parseFloat(price) * 100);

    const input: CreateEventInput = {
      ticketmasterId: catalogEvent.id,
      startsAt: `${startsAt}:00-03:00`,
      venue: {
        name: venueName,
        address,
        city,
        state,
      },
      priceInCents,
      rows: rows.map((row) => ({
        label: row.label,
        seatCount: Number.parseInt(row.seatCount, 10),
      })),
    };

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdEvent = await createEvent(input, accessToken);
      onCreated(createdEvent);
    } catch {
      setErrorMessage(
        "Não foi possível criar o rascunho. Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper
      elevation={0}
      square
      sx={{
        border: "1px solid",
        borderColor: "divider",
        mt: 6,
        p: { xs: 3, md: 5 },
      }}
    >
      <Typography color="primary.main" variant="overline">
        Configuração
      </Typography>

      <Typography component="h2" variant="h3" sx={{ mt: 1 }}>
        Configure sua sessão
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 2 }}>
        Baseado em {catalogEvent.title}
      </Typography>

      <Box
        component="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        sx={{ mt: 4 }}
      >
        <Stack spacing={3}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <TextField
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            label="Data e horário"
            name="startsAt"
            onChange={(event) => {
              setStartsAt(event.target.value);
            }}
            required
            type="datetime-local"
            value={startsAt}
          />

          <Typography component="h3" variant="h5">
            Local
          </Typography>

          <TextField
            label="Nome do local"
            name="venueName"
            onChange={(event) => {
              setVenueName(event.target.value);
            }}
            required
            value={venueName}
          />

          <TextField
            label="Endereço"
            name="address"
            onChange={(event) => {
              setAddress(event.target.value);
            }}
            required
            value={address}
          />

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(0, 1fr) 120px",
              },
            }}
          >
            <TextField
              label="Cidade"
              name="city"
              onChange={(event) => {
                setCity(event.target.value);
              }}
              required
              value={city}
            />

            <TextField
              slotProps={{
                htmlInput: {
                  maxLength: 2,
                },
              }}
              label="Estado"
              name="state"
              onChange={(event) => {
                setState(event.target.value.toUpperCase());
              }}
              required
              value={state}
            />
          </Box>

          <TextField
            slotProps={{
              htmlInput: {
                min: 0.01,
                step: 0.01,
              },
            }}
            label="Preço por assento em reais"
            name="price"
            onChange={(event) => {
              setPrice(event.target.value);
            }}
            required
            type="number"
            value={price}
          />

          <Box>
            <Typography component="h3" variant="h5">
              Mapa de assentos
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Defina as fileiras e a quantidade de lugares.
            </Typography>
          </Box>

          {rows.map((row, index) => {
            const rowNumber = index + 1;

            return (
              <Box
                key={row.id}
                sx={{
                  alignItems: "start",
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "minmax(0, 1fr) minmax(0, 1fr) auto",
                  },
                }}
              >
                <TextField
                  slotProps={{
                    htmlInput: {
                      maxLength: 10,
                    },
                  }}
                  label={`Fileira ${rowNumber}`}
                  onChange={(event) => {
                    updateRow(
                      row.id,
                      "label",
                      event.target.value.toUpperCase(),
                    );
                  }}
                  required
                  value={row.label}
                />

                <TextField
                  slotProps={{
                    htmlInput: {
                      min: 1,
                      max: 100,
                    },
                  }}
                  label={`Quantidade de assentos da fileira ${rowNumber}`}
                  onChange={(event) => {
                    updateRow(row.id, "seatCount", event.target.value);
                  }}
                  required
                  type="number"
                  value={row.seatCount}
                />

                <Button
                  aria-label={`Remover fileira ${rowNumber}`}
                  disabled={rows.length === 1}
                  onClick={() => {
                    removeRow(row.id);
                  }}
                  type="button"
                  variant="text"
                >
                  Remover
                </Button>
              </Box>
            );
          })}

          <Button
            disabled={rows.length >= 26}
            onClick={() => {
              setRows((currentRows) => [...currentRows, createEmptyRow()]);
            }}
            startIcon={<AddIcon />}
            type="button"
            variant="outlined"
          >
            Adicionar fileira
          </Button>

          <Button
            disabled={isSubmitting}
            size="large"
            type="submit"
            variant="contained"
          >
            {isSubmitting ? (
              <>
                <CircularProgress
                  aria-label="Criando rascunho"
                  color="inherit"
                  size={20}
                  sx={{ mr: 1 }}
                />
                Criando rascunho
              </>
            ) : (
              "Criar rascunho"
            )}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
