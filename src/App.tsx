import { useEffect, useMemo, useState } from "react";
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
import MapView, {
  type MapSelection,
  type StoreWithBusinesses,
} from "./components/MapView";
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

type City = { City_Code: string; City_Name: string };
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
  Region_Code?: string | null;
  Region_Name?: string | null;
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

type SidebarCityItem = { code: string; name: string; type: "city" };
type SidebarAreaItem = {
  code: string;
  name: string;
  type: "area";
  cities: string[];
  Departments: Department[];
  zoneName?: string | null;
};
type SidebarZoneItem = {
  code: string;
  name: string;
  type: "zone";
  cities: string[];
  areas: string[];
  Departments: Department[];
};

type SidebarItem = SidebarCityItem | SidebarAreaItem | SidebarZoneItem;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function App() {
  const [filterMode, setFilterMode] = useState<"city" | "area" | "zone">(
    "city"
  );
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [stores, setStores] = useState<StoreWithBusinesses[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<StoreWithBusinesses[]>(
        "http://localhost:4000/api/combined/stores-with-businesses"
      )
      .then((res) => {
        const normalized = res.data.map((store) => {
          const areaName = (store.Area_Name ?? "").trim() || "Unassigned Area";
          const cityName = store.City_Name?.trim() || null;
          const regionName = store.Region_Name?.trim() || null;
          const regionCode =
            store.Region_Code != null && store.Region_Code !== ""
              ? String(store.Region_Code)
              : null;
          const zoneName =
            store.Zone_Name?.trim() ||
            regionName ||
            "Unassigned Region";
          const zoneCodeRaw =
            store.Zone_Code != null && store.Zone_Code !== ""
              ? store.Zone_Code
              : regionCode;
          const zoneCode = zoneCodeRaw
            ? String(zoneCodeRaw)
            : `zone-${slugify(zoneName)}`;

          return {
            ...store,
            Area_Name: areaName,
            City_Name: cityName,
            Zone_Name: zoneName,
            Zone_Code: zoneCode,
            Region_Name: regionName,
            Region_Code: regionCode,
          } satisfies StoreWithBusinesses;
        });

        setStores(normalized);
      })
      .catch((error) => {
        console.error("Failed to load store data", error);
      });
  }, []);

  const cityList = useMemo<City[]>(() => {
    const map = new Map<string, City>();

    for (const store of stores) {
      const rawName = store.City_Name?.trim();
      const fallback = store.Area_Name?.replace(/ Area$/i, "").trim();
      const cityName = rawName && rawName.length > 0 ? rawName : fallback;
      if (!cityName) continue;

      const key = cityName.toLowerCase();
      if (!map.has(key)) {
        const codeCandidate =
          store.City_Code != null && store.City_Code !== ""
            ? String(store.City_Code)
            : key;
        map.set(key, { City_Code: codeCandidate, City_Name: cityName });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.City_Name.localeCompare(b.City_Name)
    );
  }, [stores]);

  const areaList = useMemo<Area[]>(() => {
    const grouped = new Map<string, Area & { CitySet: Set<string> }>();

    for (const store of stores) {
      const areaName = store.Area_Name ?? "Unassigned Area";
      const areaCode =
        store.Area_Code != null && store.Area_Code !== ""
          ? String(store.Area_Code)
          : `area-${slugify(areaName)}`;
      const zoneName = store.Zone_Name ?? "Unassigned Region";
      const zoneCode =
        store.Zone_Code != null && store.Zone_Code !== ""
          ? String(store.Zone_Code)
          : `zone-${slugify(zoneName)}`;

      if (!grouped.has(areaCode)) {
        grouped.set(areaCode, {
          Area_Code: areaCode,
          Area_Name: areaName,
          Cities: [],
          Departments: [],
          Zone_Code: zoneCode,
          Zone_Name: zoneName,
          CitySet: new Set<string>(),
        });
      }

      const entry = grouped.get(areaCode);
      if (!entry) continue;

      const cityName = store.City_Name?.trim();
      if (cityName && cityName.length > 0) {
        entry.CitySet.add(cityName);
      }

      entry.Departments.push({
        Department_Code: store.Department_Code,
        Department_Name: store.Department_Name,
        SQM: store.SQM ?? null,
        Longitude: store.Longitude ?? null,
        Latitude: store.Latitude ?? null,
        Adresse: store.Adresse ?? null,
        Format: store.Format ?? null,
        City_Name: cityName ?? null,
        Area_Code: areaCode,
        Area_Name: areaName,
        Zone_Code: zoneCode,
        Zone_Name: zoneName,
        Region_Code: store.Region_Code ?? null,
        Region_Name: store.Region_Name ?? null,
      });
    }

    return Array.from(grouped.values())
      .map(({ CitySet, ...area }) => ({
        ...area,
        Cities: Array.from(CitySet).sort((a, b) => a.localeCompare(b)),
        Departments: area.Departments.sort((a, b) =>
          a.Department_Name.localeCompare(b.Department_Name)
        ),
      }))
      .sort((a, b) => a.Area_Name.localeCompare(b.Area_Name));
  }, [stores]);

  const zoneList = useMemo<Zone[]>(() => {
    const grouped = new Map<string, Zone & { AreaSet: Set<string>; CitySet: Set<string> }>();

    for (const store of stores) {
      const zoneName = store.Zone_Name ?? "Unassigned Region";
      const zoneCode =
        store.Zone_Code != null && store.Zone_Code !== ""
          ? String(store.Zone_Code)
          : `zone-${slugify(zoneName)}`;

      if (!grouped.has(zoneCode)) {
        grouped.set(zoneCode, {
          Zone_Code: zoneCode,
          Zone_Name: zoneName,
          Areas: [],
          Cities: [],
          Departments: [],
          AreaSet: new Set<string>(),
          CitySet: new Set<string>(),
        });
      }

      const entry = grouped.get(zoneCode);
      if (!entry) continue;

      const areaName = store.Area_Name ?? "Unassigned Area";
      entry.AreaSet.add(areaName);

      const cityName = store.City_Name?.trim();
      if (cityName && cityName.length > 0) {
        entry.CitySet.add(cityName);
      }

      entry.Departments.push({
        Department_Code: store.Department_Code,
        Department_Name: store.Department_Name,
        SQM: store.SQM ?? null,
        Longitude: store.Longitude ?? null,
        Latitude: store.Latitude ?? null,
        Adresse: store.Adresse ?? null,
        Format: store.Format ?? null,
        City_Name: cityName ?? null,
        Area_Code: store.Area_Code ?? null,
        Area_Name: areaName,
        Zone_Code: zoneCode,
        Zone_Name: zoneName,
        Region_Code: store.Region_Code ?? null,
        Region_Name: store.Region_Name ?? null,
      });
    }

    return Array.from(grouped.values())
      .map(({ AreaSet, CitySet, ...zone }) => ({
        ...zone,
        Areas: Array.from(AreaSet).sort((a, b) => a.localeCompare(b)),
        Cities: Array.from(CitySet).sort((a, b) => a.localeCompare(b)),
        Departments: zone.Departments.sort((a, b) =>
          a.Department_Name.localeCompare(b.Department_Name)
        ),
      }))
      .sort((a, b) => a.Zone_Name.localeCompare(b.Zone_Name));
  }, [stores]);

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
            Cities: {areaItem.cities.join(", ")}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Zone: {areaItem.zoneName ?? "Unassigned"}
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
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Areas covered
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
            {zoneItem.areas.map((area) => (
              <Chip key={area} label={area} size="small" />
            ))}
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Cities linked
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
            {zoneItem.cities.map((city) => (
              <Chip key={city} label={city} size="small" color="primary" />
            ))}
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
        ? cityList.map((c) => ({
            code: c.City_Code,
            name: c.City_Name,
            type: "city" as const,
          }))
        : filterMode === "area"
        ? areaList.map((a) => ({
            code: a.Area_Code,
            name: a.Area_Name,
            cities: a.Cities,
            Departments: a.Departments,
            zoneName: a.Zone_Name,
            type: "area" as const,
          }))
        : zoneList.map((z) => ({
            code: z.Zone_Code ?? `zone-${z.Zone_Name}`,
            name: z.Zone_Name,
            cities: z.Cities,
            areas: z.Areas,
            Departments: z.Departments,
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
                <ListItemText primary={item.name} />
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
