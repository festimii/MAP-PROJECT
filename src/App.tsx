import { useState, useEffect, useMemo } from "react";
import { Card, CardActionArea, CardContent } from "@mui/material";
import {
  AppBar,
  Toolbar,
  Typography,
  CssBaseline,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  createTheme,
  ThemeProvider,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  LocationCity,
  Map as MapIcon,
  Layers,
} from "@mui/icons-material";
import { Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import MapView, { type MapSelection } from "./components/MapView";
import ReportView from "./components/ReportView";

const drawerWidth = 300;

const darkTheme = createTheme({
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

type City = { City_Code: number; City_Name: string };
type Department = {
  Department_Code: string;
  Department_Name: string;
  SQM: number | null;
  Longitude: number | null;
  Latitude: number | null;
  Adresse: string | null;
  Format: string | null;
  City_Name?: string | null;
  Area_Code?: string | null;
  Area_Name?: string | null;
  Zone_Code?: string | null;
  Zone_Name?: string | null;
};

type Area = {
  Area_Code: string;
  Area_Name: string;
  Zone_Code?: string | null;
  Zone_Name?: string | null;
  Cities: string[];
  Departments: Department[];
};

type Zone = {
  Zone_Code: string | null;
  Zone_Name: string;
  Areas: string[];
  Cities: string[];
  Departments: Department[];
};

type SidebarCityItem = {
  code: number;
  name: string;
  type: "city";
  storeCount: number;
};
type SidebarAreaItem = {
  code: string;
  name: string;
  type: "area";
  cities: string[];
  Departments: Department[];
  zoneName?: string | null;
  zoneCode?: string | null;
};
type SidebarZoneItem = {
  code: string;
  name: string;
  type: "zone";
  cities: string[];
  areas: string[];
  Departments: Department[];
  zoneCode?: string | null;
};

type SidebarItem = SidebarCityItem | SidebarAreaItem | SidebarZoneItem;

export default function App() {
  const [filterMode, setFilterMode] = useState<"city" | "area" | "zone">(
    "city"
  );
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [cityList, setCityList] = useState<City[]>([]);
  const [areaList, setAreaList] = useState<Area[]>([]);
  const [zoneList, setZoneList] = useState<Zone[]>([]);
  const navigate = useNavigate();

  const cityStoreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    areaList.forEach((area) => {
      area.Departments.forEach((department) => {
        const rawName = department.City_Name || area.Area_Name;
        const cityName = rawName ? rawName.trim() : "Unknown";
        counts.set(cityName, (counts.get(cityName) ?? 0) + 1);
      });
    });
    return counts;
  }, [areaList]);

  // Load cities and areas
  useEffect(() => {
    axios
      .get<City[]>("http://localhost:4000/api/cities")
      .then((res) =>
        setCityList(
          res.data.map((city) => ({
            ...city,
            City_Name: city.City_Name.trim(),
          }))
        )
      );
    axios
      .get<Area[]>("http://localhost:4000/api/areas/filters")
      .then((res) => {
        const sorted = res.data
          .map((area) => ({
            ...area,
            Cities: [...area.Cities].sort((a, b) => a.localeCompare(b)),
            Departments: [...area.Departments].sort((a, b) =>
              a.Department_Name.localeCompare(b.Department_Name)
            ),
          }))
          .sort((a, b) => a.Area_Name.localeCompare(b.Area_Name));
        setAreaList(sorted);
      });
    axios
      .get<Zone[]>("http://localhost:4000/api/zones")
      .then((res) => {
        const sorted = res.data
          .map((zone) => ({
            ...zone,
            Cities: [...zone.Cities].sort((a, b) => a.localeCompare(b)),
            Areas: [...zone.Areas].sort((a, b) => a.localeCompare(b)),
            Departments: [...zone.Departments].sort((a, b) =>
              a.Department_Name.localeCompare(b.Department_Name)
            ),
          }))
          .sort((a, b) => a.Zone_Name.localeCompare(b.Zone_Name));
        setZoneList(sorted);
      });
  }, []);

  const handleFilterModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextMode: "city" | "area" | "zone" | null
  ) => {
    if (nextMode) {
      setFilterMode(nextMode);
      setSelectedItem(null);
    }
  };

  const handleSelect = (item: SidebarItem) => {
    setSelectedItem(item);
    if (item.type === "city") {
      navigate(`/report/${encodeURIComponent(item.name)}`);
    }
  };

  const handleBack = () => {
    setSelectedItem(null);
  };

  let mapSelection: MapSelection | null = null;
  if (selectedItem?.type === "city") {
    mapSelection = { mode: "city", city: selectedItem.name };
  } else if (selectedItem?.type === "area" && filterMode === "area") {
    mapSelection = {
      mode: "area",
      area: selectedItem.name,
      cities: selectedItem.cities,
    };
  } else if (selectedItem?.type === "zone" && filterMode === "zone") {
    mapSelection = {
      mode: "zone",
      zone: selectedItem.name,
      cities: selectedItem.cities,
      areas: selectedItem.areas,
    };
  }

  // Sidebar content
  let drawerContent;
  const areaItem =
    filterMode === "area" && selectedItem?.type === "area"
      ? selectedItem
      : null;
  const zoneItem =
    filterMode === "zone" && selectedItem?.type === "zone"
      ? selectedItem
      : null;

  if (areaItem) {
    const areaStoreCount = areaItem.Departments.length;
    const totalAreaSqm = areaItem.Departments.reduce(
      (sum, department) => sum + (department.SQM ?? 0),
      0
    );
    const areaCityLabel = areaItem.cities.length
      ? areaItem.cities.join(", ")
      : "To be confirmed";
    // Detail mode (Area with departments)
    drawerContent = (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <Box sx={{ px: 2, py: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleBack}
            sx={{ mb: 2 }}
          >
            ← Back to Areas
          </Button>
          <Typography variant="h6">{areaItem.name}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Cities ({areaItem.cities.length}): {areaCityLabel}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Zone: {areaItem.zoneName ?? "Unassigned"}
          </Typography>
          {areaItem.zoneCode && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Zone code: {areaItem.zoneCode}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Stores tracked: {areaStoreCount}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Total SQM: {totalAreaSqm.toLocaleString()} m²
          </Typography>
        </Box>

        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Departments
          </Typography>

          {areaItem.Departments?.map((department) => (
            <Card
              key={department.Department_Code}
              variant="outlined"
              sx={{
                mb: 1.5,
                borderRadius: 2,
                bgcolor: "background.default",
                "&:hover": { boxShadow: 3, borderColor: "primary.main" },
              }}
            >
              <CardActionArea
                onClick={() =>
                  console.log("Selected department:", department)
                }
              >
                <CardContent>
                  <Typography variant="body2" fontWeight="bold">
                    {department.Department_Name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block" }}
                  >
                    Madhesia Pikes: {" "}
                    {department.SQM != null
                      ? department.SQM.toLocaleString()
                      : "N/A"}
                  </Typography>
                  {department.City_Name && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", display: "block" }}
                    >
                      City: {department.City_Name}
                    </Typography>
                  )}
                  {department.Format && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", display: "block" }}
                    >
                      Format: {department.Format}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>
    );
  } else if (zoneItem) {
    const zoneStoreCount = zoneItem.Departments.length;
    const zoneTotalSqm = zoneItem.Departments.reduce(
      (sum, department) => sum + (department.SQM ?? 0),
      0
    );
    const hasAreas = zoneItem.areas.length > 0;
    const hasCities = zoneItem.cities.length > 0;
    drawerContent = (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <Box sx={{ px: 2, py: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleBack}
            sx={{ mb: 2 }}
          >
            ← Back to Zones
          </Button>
          <Typography variant="h6">{zoneItem.name}</Typography>
          {zoneItem.zoneCode && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Zone code: {zoneItem.zoneCode}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Stores tracked: {zoneStoreCount}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Total SQM: {zoneTotalSqm.toLocaleString()} m²
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Areas covered ({zoneItem.areas.length})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
            {hasAreas ? (
              zoneItem.areas.map((area) => (
                <Chip key={area} label={area} size="small" />
              ))
            ) : (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                Areas will be assigned soon.
              </Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Cities linked ({zoneItem.cities.length})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
            {hasCities ? (
              zoneItem.cities.map((city) => (
                <Chip key={city} label={city} size="small" color="primary" />
              ))
            ) : (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                No linked cities yet.
              </Typography>
            )}
          </Box>
        </Box>

        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Stores in this zone
          </Typography>
          {zoneItem.Departments.map((department) => (
            <Card
              key={`${department.Department_Code}-${department.Area_Code}`}
              variant="outlined"
              sx={{
                mb: 1.5,
                borderRadius: 2,
                bgcolor: "background.default",
                "&:hover": { boxShadow: 3, borderColor: "primary.main" },
              }}
            >
              <CardContent>
                <Typography variant="body2" fontWeight="bold">
                  {department.Department_Name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  {department.Area_Name || "Unknown area"} · {" "}
                  {department.City_Name || "Unknown city"}
                </Typography>
                {department.Zone_Name && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block" }}
                  >
                    Zone: {department.Zone_Name}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  Madhesia Pikes: {" "}
                  {department.SQM != null
                    ? department.SQM.toLocaleString()
                    : "N/A"}
                </Typography>
                {department.Format && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block" }}
                  >
                    Format: {department.Format}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );
  } else {
    // City/Area list mode
    const items: SidebarItem[] =
      filterMode === "city"
        ? cityList.map((c) => {
            const cityName = c.City_Name.trim();
            return {
              code: c.City_Code,
              name: cityName,
              type: "city" as const,
              storeCount: cityStoreCounts.get(cityName) ?? 0,
            } satisfies SidebarCityItem;
          })
        : filterMode === "area"
        ? areaList.map((a) => ({
            code: a.Area_Code,
            name: a.Area_Name,
            cities: a.Cities,
            Departments: a.Departments,
            zoneName: a.Zone_Name,
            zoneCode: a.Zone_Code,
            type: "area" as const,
          }))
        : zoneList.map((z) => ({
            code: z.Zone_Code ?? `zone-${z.Zone_Name}`,
            name: z.Zone_Name,
            cities: z.Cities,
            areas: z.Areas,
            Departments: z.Departments,
            zoneCode: z.Zone_Code ?? null,
            type: "zone" as const,
          }));

    drawerContent = (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 1 }}>
          <ToggleButtonGroup
            value={filterMode}
            exclusive
            fullWidth
            onChange={handleFilterModeChange}
            size="small"
            color="primary"
          >
            <ToggleButton value="city">Cities</ToggleButton>
            <ToggleButton value="area">Areas</ToggleButton>
            <ToggleButton value="zone">Zones</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ px: 1, py: 1, flex: 1, overflowY: "auto" }}>
          <List disablePadding>
            {items.map((item) => (
              <ListItemButton
                key={item.code}
                selected={selectedItem?.code === item.code}
                onClick={() => handleSelect(item)}
                sx={{
                  alignItems: "flex-start",
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "black",
                    "& .MuiListItemIcon-root": { color: "black" },
                  },
                }}
              >
                <ListItemIcon sx={{ color: "text.secondary" }}>
                  {filterMode === "city" ? (
                    <LocationCity />
                  ) : filterMode === "area" ? (
                    <MapIcon />
                  ) : (
                    <Layers />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  secondary={(() => {
                    if (item.type === "city") {
                      const count = item.storeCount;
                      return `${count} store${count === 1 ? "" : "s"}`;
                    }
                    if (item.type === "area") {
                      const storeCount = item.Departments.length;
                      const cityCount = item.cities.length;
                      const cityLabel = cityCount === 1 ? "city" : "cities";
                      return `${storeCount} store${
                        storeCount === 1 ? "" : "s"
                      } • ${cityCount} ${cityLabel}`;
                    }
                    const storeCount = item.Departments.length;
                    const areaCount = item.areas.length;
                    const areaLabel = areaCount === 1 ? "area" : "areas";
                    return `${storeCount} store${
                      storeCount === 1 ? "" : "s"
                    } • ${areaCount} ${areaLabel}`;
                  })()}
                  secondaryTypographyProps={{
                    sx: {
                      color:
                        selectedItem?.code === item.code
                          ? "rgba(0,0,0,0.65)"
                          : "text.secondary",
                      fontSize: 12,
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 1, borderColor: "divider" }} />
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block" }}
          >
            © 2025 Viva Fresh
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <CssBaseline />

        {/* Navbar */}
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

        {/* Sidebar */}
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
          {drawerContent}
        </Drawer>

        {/* Main Content */}
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
                    cities={cityList}
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
