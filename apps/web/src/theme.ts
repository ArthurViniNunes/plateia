import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#171512",
      contrastText: "#fffaf1",
    },
    secondary: {
      main: "#f2b84b",
    },
    background: {
      default: "#fffaf1",
      paper: "#fffdf8",
    },
    text: {
      primary: "#171512",
      secondary: "#686057",
    },
    divider: "#d9d0c4",
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    h2: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    h3: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    h4: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    h5: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 600,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 2,
  },
});
