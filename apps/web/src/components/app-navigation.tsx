import LogoutIcon from "@mui/icons-material/Logout";
import { AppBar, Box, Button, Container, Toolbar } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  clearAuthenticatedSession,
  readAuthenticatedUser,
  subscribeToAuthenticatedSession,
} from "../session/auth-session";

export function AppNavigation() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readAuthenticatedUser());

  useEffect(() => {
    return subscribeToAuthenticatedSession(() => {
      setUser(readAuthenticatedUser());
    });
  }, []);

  function handleLogout() {
    clearAuthenticatedSession();

    void navigate("/login", {
      replace: true,
    });
  }

  return (
    <AppBar
      color="transparent"
      elevation={0}
      position="static"
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          disableGutters
          sx={{
            gap: 1,
            justifyContent: "space-between",
            minHeight: 72,
          }}
        >
          <Button
            aria-label="Plateia"
            component={Link}
            to="/"
            sx={{
              color: "primary.main",
              fontSize: "1.25rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            Plateia
          </Button>

          <Box
            component="nav"
            aria-label="Navegação principal"
            sx={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "flex-end",
            }}
          >
            {user?.role === "CUSTOMER" && (
              <Button component={Link} to="/tickets">
                Meus ingressos
              </Button>
            )}

            {user?.role === "ORGANIZER" && (
              <Button component={Link} to="/organizer/events">
                Gerenciar eventos
              </Button>
            )}

            {user?.role === "GATEKEEPER" && (
              <Button component={Link} to="/gate">
                Portaria
              </Button>
            )}

            {user ? (
              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                type="button"
              >
                Sair
              </Button>
            ) : (
              <Button component={Link} to="/login">
                Entrar
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
