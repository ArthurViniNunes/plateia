import { alpha, createTheme } from "@mui/material/styles";

const ink = "#0a0a0a";
const paper = "#f4f2ec";
const electricBlue = "#2457ff";
const spotlight = "#ffd400";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: electricBlue, dark: "#1239c8", contrastText: "#ffffff" },
    secondary: { main: spotlight, contrastText: ink },
    background: { default: paper, paper: "#ffffff" },
    text: { primary: ink, secondary: "#64645f" },
    divider: "#b9b8b1",
    success: { main: "#08783f" },
    error: { main: "#d52b1e" },
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Archivo Black", "Arial Black", sans-serif',
      fontSize: "clamp(3rem, 8vw, 7.5rem)",
      fontWeight: 400,
      letterSpacing: "-0.065em",
      lineHeight: 0.88,
    },
    h2: {
      fontFamily: '"Archivo Black", "Arial Black", sans-serif',
      fontSize: "clamp(2.35rem, 5vw, 4.6rem)",
      fontWeight: 400,
      letterSpacing: "-0.055em",
      lineHeight: 0.92,
    },
    h3: {
      fontFamily: '"Archivo Black", "Arial Black", sans-serif',
      fontSize: "clamp(2rem, 4vw, 3.25rem)",
      fontWeight: 400,
      letterSpacing: "-0.045em",
      lineHeight: 0.98,
    },
    h4: {
      fontFamily: '"Archivo Black", "Arial Black", sans-serif',
      fontSize: "clamp(1.65rem, 3vw, 2.35rem)",
      fontWeight: 400,
      letterSpacing: "-0.035em",
      lineHeight: 1,
    },
    h5: {
      fontFamily: '"Archivo Black", "Arial Black", sans-serif',
      fontWeight: 400,
      letterSpacing: "-0.025em",
      lineHeight: 1.05,
    },
    h6: { fontWeight: 700, letterSpacing: "-0.02em" },
    body1: { fontSize: "1rem", lineHeight: 1.55 },
    overline: {
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.02em",
      lineHeight: 1.5,
      textTransform: "none",
    },
    button: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
      textTransform: "none",
    },
  },
  shape: { borderRadius: 2 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "::selection": { backgroundColor: spotlight, color: ink },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
      styleOverrides: {
        root: {
          paddingLeft: "clamp(20px, 4vw, 48px)",
          paddingRight: "clamp(20px, 4vw, 48px)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 2,
          minHeight: 44,
          paddingInline: 20,
          transition:
            "background-color 160ms ease, color 160ms ease, transform 160ms ease",
          "&:focus-visible": {
            outline: `3px solid ${spotlight}`,
            outlineOffset: 3,
          },
        },
        contained: {
          border: "2px solid transparent",
          "&:hover": { backgroundColor: ink },
        },
        outlined: {
          borderWidth: 2,
          "&:hover": { borderWidth: 2 },
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { defaultProps: { elevation: 0 } },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: spotlight,
          borderRadius: 2,
          color: ink,
          fontWeight: 700,
        },
      },
    },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderRadius: 2,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: ink,
            borderWidth: 1.5,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: electricBlue,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: electricBlue,
            borderWidth: 3,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha(ink, 0.24)}`,
          borderRadius: 2,
        },
      },
    },
  },
});
