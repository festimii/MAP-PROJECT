import { createTheme } from "@mui/material";

const backgroundBase = "#0b1120";
const surfaceOverlay = "rgba(15, 23, 42, 0.86)";
const appBarGradient =
  "linear-gradient(120deg, rgba(15,23,42,0.94) 0%, rgba(30,64,175,0.78) 55%, rgba(12,74,110,0.82) 100%)";
const drawerGradient =
  "linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(17, 24, 39, 0.88) 45%, rgba(30, 41, 59, 0.9) 100%)";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#1d4ed8",
    },
    secondary: { main: "#38bdf8" },
    background: { default: backgroundBase, paper: surfaceOverlay },
    divider: "rgba(148, 163, 184, 0.16)",
    text: {
      primary: "#f1f5f9",
      secondary: "rgba(226, 232, 240, 0.72)",
    },
  },
  typography: {
    fontFamily: "Inter, 'Segoe UI', sans-serif",
    fontSize: 14,
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: backgroundBase,
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(96, 165, 250, 0.12), transparent 55%), radial-gradient(circle at 80% 0%, rgba(45, 212, 191, 0.12), transparent 50%)",
          color: "#f8fafc",
          scrollbarColor: "rgba(71, 85, 105, 0.6) transparent",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(71, 85, 105, 0.6)",
            borderRadius: "999px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "rgba(100, 116, 139, 0.8)",
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: appBarGradient,
          backgroundColor: "transparent",
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 18px 40px rgba(8, 15, 30, 0.45)",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          paddingLeft: "clamp(16px, 2vw, 28px)",
          paddingRight: "clamp(16px, 2vw, 28px)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: drawerGradient,
          backgroundColor: "transparent",
          borderRight: "1px solid rgba(148, 163, 184, 0.16)",
          backdropFilter: "blur(12px)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: "2px 6px",
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            transform: "translateY(-1px)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(59, 130, 246, 0.22)",
            color: backgroundBase,
            boxShadow: "0 12px 24px rgba(59, 130, 246, 0.28)",
            "&:hover": {
              backgroundColor: "rgba(59, 130, 246, 0.28)",
            },
            "& .MuiListItemIcon-root": { color: backgroundBase },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          borderRadius: 999,
          padding: 4,
          gap: 4,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: "none",
          borderRadius: 999,
          padding: "6px 16px",
          color: "rgba(226, 232, 240, 0.78)",
          fontWeight: 600,
          "&.Mui-selected": {
            backgroundColor: "rgba(59, 130, 246, 0.25)",
            color: "#f8fafc",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
        outlined: {
          borderColor: "rgba(148, 163, 184, 0.32)",
          color: "#e2e8f0",
          "&:hover": {
            borderColor: "rgba(148, 163, 184, 0.5)",
            backgroundColor: "rgba(148, 163, 184, 0.08)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          backdropFilter: "blur(6px)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          boxShadow: "0 20px 40px rgba(8, 15, 30, 0.35)",
        },
      },
    },
  },
});
