import { useMemo, useState, type MouseEvent } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Toolbar,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Menu as MenuIcon } from "@mui/icons-material";
import { Route, Routes, useNavigate } from "react-router-dom";

import MapView, { type MapSelection } from "./components/MapView";
import ReportView from "./components/ReportView";
import { SidebarDrawer } from "./components/sidebar/SidebarDrawer";
import { useVivaNetworkData } from "./hooks/useVivaNetworkData";
import type { FilterMode, SidebarItem } from "./types/viva";
import { appTheme } from "./theme";

const drawerWidth = 300;

export default function App() {
  const [filterMode, setFilterMode] = useState<FilterMode>("city");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const navigate = useNavigate();

  const { loading, error, cities, cityItems, areaItems, zoneItems, stores } =
    useVivaNetworkData();

  const handleFilterModeChange = (
    _event: MouseEvent<HTMLElement>,
    nextMode: FilterMode | null
  ) => {
    if (nextMode && nextMode !== filterMode) {
      setFilterMode(nextMode);
      setSelectedItem(null);
    }
  };

  const handleSelectItem = (item: SidebarItem) => {
    setSelectedItem(item);
    if (item.type === "city") {
      navigate(`/report/${encodeURIComponent(item.name)}`);
    }
  };

  const handleBack = () => {
    setSelectedItem(null);
  };

  const mapSelection = useMemo<MapSelection | null>(() => {
    if (selectedItem?.type === "city") {
      return { mode: "city", city: selectedItem.name };
    }

    if (selectedItem?.type === "area" && filterMode === "area") {
      return {
        mode: "area",
        area: selectedItem.name,
        cities: selectedItem.cities,
      };
    }

    if (selectedItem?.type === "zone" && filterMode === "zone") {
      return {
        mode: "zone",
        zone: selectedItem.name,
        cities: selectedItem.cities,
        areas: selectedItem.areas,
      };
    }

    return null;
  }, [filterMode, selectedItem]);

  return (
    <ThemeProvider theme={appTheme}>
      <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <CssBaseline />

        <AppBar
          position="fixed"
          elevation={1}
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ px: 3 }}>
            <MenuIcon sx={{ mr: 2, color: "primary.main" }} />
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: "bold", letterSpacing: 0.5 }}
            >
              🌍 Viva Fresh — Demografia
            </Typography>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          <SidebarDrawer
            filterMode={filterMode}
            onFilterModeChange={handleFilterModeChange}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            onBack={handleBack}
            loading={loading}
            error={error}
            cityItems={cityItems}
            areaItems={areaItems}
            zoneItems={zoneItems}
          />
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Toolbar />
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Routes>
              <Route
                path="/"
                element={
                  <MapView
                    selection={mapSelection}
                    cities={cities}
                    stores={stores}
                  />
                }
              />
              <Route path="/report/:name" element={<ReportView />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
