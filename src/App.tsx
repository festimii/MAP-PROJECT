import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import { Route, Routes, useNavigate } from "react-router-dom";

import MapView from "./components/MapView";
import ReportView from "./components/ReportView";
import Sidebar from "./components/sidebar/Sidebar";
import { useVivaFreshNetwork } from "./hooks/useVivaFreshNetwork";
import type { FilterMode, SidebarItem } from "./models/viva";
import type { MapSelection } from "./models/map";
import { darkTheme } from "./theme/darkTheme";

const drawerWidth = 300;

const resolveMapSelection = (
  filterMode: FilterMode,
  selectedItem: SidebarItem | null
): MapSelection | null => {
  if (!selectedItem) {
    return null;
  }

  switch (selectedItem.type) {
    case "city":
      return { mode: "city", city: selectedItem.name };
    case "area":
      return filterMode === "area"
        ? { mode: "area", area: selectedItem.name, cities: selectedItem.cities }
        : null;
    case "zone":
      return filterMode === "zone"
        ? {
            mode: "zone",
            zone: selectedItem.name,
            cities: selectedItem.cities,
            areas: selectedItem.areas,
          }
        : null;
    default:
      return null;
  }
};

export default function App() {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<FilterMode>("city");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const { cities, cityItems, areaItems, zoneItems, stores, loading, error } =
    useVivaFreshNetwork();

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const availableItems =
      filterMode === "city"
        ? cityItems
        : filterMode === "area"
        ? areaItems
        : zoneItems;

    const stillExists = availableItems.some(
      (item) => item.code === selectedItem.code
    );

    if (!stillExists) {
      setSelectedItem(null);
    }
  }, [filterMode, selectedItem, cityItems, areaItems, zoneItems]);

  const handleFilterModeChange = (mode: FilterMode) => {
    setFilterMode(mode);
    setSelectedItem(null);
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

  const mapSelection = useMemo(
    () => resolveMapSelection(filterMode, selectedItem),
    [filterMode, selectedItem]
  );

  return (
    <ThemeProvider theme={darkTheme}>
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
          <Sidebar
            filterMode={filterMode}
            selectedItem={selectedItem}
            onFilterModeChange={handleFilterModeChange}
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
