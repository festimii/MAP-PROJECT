import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Stack,
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
import { formatNumber } from "./utils/format";

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

  const networkSummary = useMemo(() => {
    const cityCount = cityItems.length;
    const areaCount = areaItems.length;
    const storeCount = stores.length;
    const totalSqm = cityItems.reduce((total, city) => total + city.totalSqm, 0);
    const geocodedCount = cityItems.reduce(
      (total, city) => total + city.geocodedCount,
      0
    );
    const geoCoverage =
      storeCount > 0
        ? Math.round((geocodedCount / storeCount) * 100)
        : 0;

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
            background:
              "linear-gradient(120deg, rgba(15,23,42,0.95) 0%, rgba(30,64,175,0.82) 60%, rgba(12,74,110,0.85) 100%)",
            borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Toolbar
            sx={{
              px: { xs: 2, lg: 3 },
              py: { xs: 1.5, md: 2 },
              gap: 3,
              alignItems: { xs: "flex-start", md: "center" },
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(59, 130, 246, 0.18)",
                  border: "1px solid rgba(59, 130, 246, 0.32)",
                  color: "primary.light",
                  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.45)",
                }}
              >
                <MenuIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  noWrap
                  sx={{ fontWeight: "bold", letterSpacing: 0.5 }}
                >
                  Viva Fresh — Demografia
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(191, 219, 254, 0.9)", mt: 0.25 }}
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
                <Box
                  key={label}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    bgcolor: "rgba(15, 23, 42, 0.38)",
                    minWidth: 120,
                    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.35)",
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
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, color: "common.white" }}
                  >
                    {value}
                  </Typography>
                  {helper && (
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(191, 219, 254, 0.6)" }}
                    >
                      {helper}
                    </Typography>
                  )}
                </Box>
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
              background:
                "linear-gradient(180deg, rgba(17, 24, 39, 0.94) 0%, rgba(17, 24, 39, 0.82) 42%, rgba(30, 41, 59, 0.88) 100%)",
              borderRight: "1px solid rgba(148, 163, 184, 0.25)",
              backdropFilter: "blur(8px)",
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
              "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.12), transparent 55%), radial-gradient(circle at 85% 10%, rgba(14, 116, 144, 0.12), transparent 45%)",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 92, md: 104 } }} />
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
