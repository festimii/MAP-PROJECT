import { createTheme } from "@mui/material";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#90caf9" },
    background: { default: "#121212", paper: "#1e1e1e" },
    divider: "#2c2c2c",
  },
  typography: { fontFamily: "Inter, Roboto, sans-serif", fontSize: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#444 #1e1e1e",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "#1e1e1e" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#444",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#666" },
        },
      },
    },
  },
});
