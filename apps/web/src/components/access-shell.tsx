import { Box, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function AccessShell({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        bgcolor: "background.default",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(360px, .8fr) minmax(520px, 1.2fr)",
        },
        minHeight: "calc(100vh - 72px)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          alignItems: "center",
          bgcolor: "primary.main",
          display: { xs: "none", md: "flex" },
          justifyContent: "center",
          overflow: "hidden",
          p: 6,
          position: "relative",
        }}
      >
        <Box
          sx={{
            bgcolor: "secondary.main",
            borderRadius: "50%",
            height: "min(34vw, 470px)",
            position: "absolute",
            width: "min(34vw, 470px)",
          }}
        />
        <Typography
          sx={{
            color: "text.primary",
            fontFamily: '"Archivo Black", sans-serif',
            fontSize: "clamp(3.5rem, 6.5vw, 7.5rem)",
            letterSpacing: "-0.075em",
            lineHeight: 0.78,
            position: "relative",
            transform: "rotate(-7deg)",
          }}
        >
          SEU
          <br />
          LUGAR
          <br />
          AQUI.
        </Typography>
      </Box>

      <Box sx={{ alignItems: "center", display: "flex", py: { xs: 6, md: 8 } }}>
        <Container className="poster-reveal" maxWidth="sm">
          {children}
        </Container>
      </Box>
    </Box>
  );
}
