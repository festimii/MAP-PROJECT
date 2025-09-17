import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import { Route, Routes } from "react-router-dom";

import MapView from "./components/MapView";
import ReportView from "./components/ReportView";
import Sidebar from "./components/sidebar/Sidebar";
import { useVivaFreshNetwork } from "./hooks/useVivaFreshNetwork";
import type { FilterMode, SidebarItem } from "./models/viva";
import type { MapSelection } from "./models/map";
import { darkTheme } from "./theme/darkTheme";
import { formatNumber } from "./utils/format";

const drawerWidth = 280;
const appBarHeight = { xs: 20, md: 25 } as const;

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
  const [filterMode, setFilterMode] = useState<FilterMode>("city");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const { cities, cityItems, areaItems, zoneItems, stores, loading, error } =
    useVivaFreshNetwork();

  const networkSummary = useMemo(() => {
    const cityCount = cityItems.length;
    const areaCount = areaItems.length;
    const storeCount = stores.length;
    const totalSqm = cityItems.reduce(
      (total, city) => total + city.totalSqm,
      0
    );
    const geocodedCount = cityItems.reduce(
      (total, city) => total + city.geocodedCount,
      0
    );
    const geoCoverage =
      storeCount > 0 ? Math.round((geocodedCount / storeCount) * 100) : 0;

    return {
      cityCount,
      areaCount,
      storeCount,
      totalSqm,
      geocodedCount,
      geoCoverage,
    };
  }, [cityItems, areaItems, stores]);

  const headerStats = useMemo(
    () => [
      { label: "Cities", value: formatNumber(networkSummary.cityCount) },
      { label: "Areas", value: formatNumber(networkSummary.areaCount) },
      {
        label: "Viva Fresh stores",
        value: formatNumber(networkSummary.storeCount),
        helper: `${formatNumber(networkSummary.totalSqm)} m² mapped`,
      },
      {
        label: "Geo coverage",
        value: `${networkSummary.geoCoverage}%`,
        helper: `${formatNumber(networkSummary.geocodedCount)} geocoded`,
      },
    ],
    [networkSummary]
  );

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
            ml: `${drawerWidth}px`,
            width: `calc(100% - ${drawerWidth}px)`,
          }}
        >
          <Toolbar
            sx={{
              minHeight: appBarHeight,

              alignItems: { xs: "flex-start", md: "center" },
              flexWrap: { xs: "wrap", md: "nowrap" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box></Box>
              <Box>
                <Typography
                  variant="h6"
                  noWrap
                  sx={{ fontWeight: 400, letterSpacing: 0.4 }}
                >
                  Viva Fresh — Demografia
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 0.25 }}
                >
                  Live network intelligence across Kosovo
                </Typography>
              </Box>
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                ml: { xs: 0, md: "auto" },
                flexWrap: "wrap",
                alignItems: "stretch",
                justifyContent: { xs: "flex-start", md: "flex-end" },
              }}
            >
              {headerStats.map(({ label, value, helper }) => (
                <Paper
                  key={label}
                  sx={{
                    px: 2,
                    py: 0.25,
                    borderRadius: 2,
                    minWidth: 100,
                    bgcolor: "rgba(15, 23, 42, 0.55)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    boxShadow: "0 16px 30px rgba(8, 15, 30, 0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    alignItems: "center", // ✅ center horizontally
                    justifyContent: "center", // ✅ center vertically if needed
                    textAlign: "center", // ✅ center text inside
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(191, 219, 254, 0.75)",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 400 }}>
                    {value}
                  </Typography>
                  {helper && (
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(191, 219, 254, 0.75)" }}
                    >
                      {helper}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
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
              paddingTop: 0,
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
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15), transparent 55%), radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.12), transparent 45%)",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Toolbar sx={{ minHeight: appBarHeight }} />
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
