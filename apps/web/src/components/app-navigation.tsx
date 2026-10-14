import LogoutIcon from "@mui/icons-material/Logout";
import { AppBar, Box, Button, Container, Toolbar } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  clearAuthenticatedSession,
  readAuthenticatedUser,
  subscribeToAuthenticatedSession,
} from "../session/auth-session";

function Brand() {
  return (
    <Box
      aria-label="Plateia"
      component={Link}
      to="/"
      sx={{
        alignItems: "center",
        display: "inline-flex",
        gap: 1.25,
        textDecoration: "none",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          bgcolor: "secondary.main",
          borderRadius: "50% 50% 6% 50%",
          height: 30,
          transform: "rotate(-12deg)",
          width: 30,
        }}
      />
      <Box
        component="span"
        sx={{
          color: "common.white",
          fontFamily: '"Archivo Black", sans-serif',
          fontSize: { xs: "1.12rem", sm: "1.35rem" },
          letterSpacing: "-0.055em",
          lineHeight: 1,
        }}
      >
        PLATEIA
      </Box>
    </Box>
  );
}

export function AppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => readAuthenticatedUser());

  useEffect(() => {
    return subscribeToAuthenticatedSession(() => {
      setUser(readAuthenticatedUser());
    });
  }, []);

  function handleLogout() {
    clearAuthenticatedSession();
    void navigate("/login", { replace: true });
  }

  const accountLink =
    user?.role === "CUSTOMER"
      ? { label: "Meus ingressos", to: "/tickets" }
      : user?.role === "ORGANIZER"
        ? { label: "Gerenciar eventos", to: "/organizer/events" }
        : user?.role === "GATEKEEPER"
          ? { label: "Portaria", to: "/gate" }
          : null;

  return (
    <AppBar
      elevation={0}
      position="sticky"
      sx={{
        bgcolor: "#0a0a0a",
        borderBottom: "1px solid rgba(255,255,255,0.2)",
        color: "common.white",
      }}
    >
      <Container maxWidth={false}>
        <Toolbar
          disableGutters
          sx={{
            gap: 2,
            justifyContent: "space-between",
            minHeight: { xs: 64, sm: 72 },
          }}
        >
          <Brand />

          <Box
            component="nav"
            aria-label="Navegação principal"
            sx={{
              alignItems: "center",
              display: "flex",
              gap: { xs: 0, sm: 1 },
            }}
          >
            <Button
              component={Link}
              to="/"
              sx={{
                color:
                  location.pathname === "/" ? "secondary.main" : "common.white",
                display: { xs: "none", sm: "inline-flex" },
              }}
            >
              Agenda
            </Button>

            {accountLink && (
              <Button
                component={Link}
                to={accountLink.to}
                sx={{
                  color: location.pathname.startsWith(accountLink.to)
                    ? "secondary.main"
                    : "common.white",
                }}
              >
                {accountLink.label}
              </Button>
            )}

            {user ? (
              <Button
                aria-label="Sair"
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{ color: "common.white" }}
                type="button"
              >
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline" } }}
                >
                  Sair
                </Box>
              </Button>
            ) : (
              <Button
                component={Link}
                to="/login"
                variant="contained"
                sx={{
                  bgcolor: "secondary.main",
                  borderColor: "secondary.main",
                  color: "secondary.contrastText",
                  "&:hover": {
                    bgcolor: "common.white",
                    borderColor: "common.white",
                  },
                }}
              >
                Entrar
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
