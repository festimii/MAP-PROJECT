import { useState, useEffect } from "react";
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
  Stack,
  CircularProgress,
} from "@mui/material";
import { Menu as MenuIcon, LocationCity, Map as MapIcon, Layers } from "@mui/icons-material";
import { Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import MapView, { type MapSelection, type StoreData } from "./components/MapView";
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
  Region_Code?: string | null;
  Region_Name?: string | null;
};

type RawAreaResponse = {
  Area_Code: string;
  Area_Name: string;
  Cities: string[];
  Departments: Department[];
};

type RawZoneRecord = {
  Zone_Code: string | null;
  Zone_Name: string;
  Area_Code: string | null;
  Area_Name: string;
  City_Name: string | null;
  Region_Code: string | null;
  Region_Name: string | null;
  SQM: number | null;
  Longitude: number | null;
  Latitude: number | null;
  Adresse: string | null;
  Format: string | null;
};

type SidebarCityItem = {
  code: number;
  name: string;
  type: "city";
  storeCount: number;
  totalSqm: number;
  areaCount: number;
  geocodedCount: number;
};

type SidebarAreaItem = {
  code: string;
  name: string;
  type: "area";
  cities: string[];
  departments: Department[];
  zoneNames: string[];
  storeCount: number;
  totalSqm: number;
  geocodedCount: number;
};

type SidebarZoneItem = {
  code: string;
  name: string;
  type: "zone";
  cities: string[];
  areas: string[];
  departments: Department[];
  regionNames: string[];
  storeCount: number;
  totalSqm: number;
  geocodedCount: number;
};

type SidebarItem = SidebarCityItem | SidebarAreaItem | SidebarZoneItem;

type ZoneGroup = {
  code: string;
  name: string;
  departments: Department[];
  cities: Set<string>;
  areas: Set<string>;
  regionNames: Set<string>;
  totalSqm: number;
  geocodedCount: number;
};

const formatNumber = new Intl.NumberFormat("en-US");
const normalizeKey = (value: string) => value.trim().toLowerCase();
const sortByStoreCount = <T extends { storeCount: number; name: string }>(
  list: T[]
) =>
  list
    .slice()
    .sort(
      (a, b) => b.storeCount - a.storeCount || a.name.localeCompare(b.name)
    );

export default function App() {
  const [filterMode, setFilterMode] = useState<"city" | "area" | "zone">(
    "city"
  );
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [cityList, setCityList] = useState<City[]>([]);
  const [cityItems, setCityItems] = useState<SidebarCityItem[]>([]);
  const [areaItems, setAreaItems] = useState<SidebarAreaItem[]>([]);
  const [zoneItems, setZoneItems] = useState<SidebarZoneItem[]>([]);
  const [storesForMap, setStoresForMap] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load cities, areas and zone structures from the API and
  // reshape them for the sidebar + map experience.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [citiesRes, areasRes, zonesRes] = await Promise.all([
          axios.get<City[]>("http://localhost:4000/api/cities"),
          axios.get<RawAreaResponse[]>("http://localhost:4000/api/areas/filters"),
          axios.get<RawZoneRecord[]>("http://localhost:4000/api/zones"),
        ]);

        if (cancelled) {
          return;
        }

        setCityList(citiesRes.data);

        const zoneByDepartment = new Map<string, RawZoneRecord>();
        for (const record of zonesRes.data) {
          const rawKey = record.Zone_Code ?? record.Zone_Name;
          if (!rawKey) {
            continue;
          }
          const key = String(rawKey).trim();
          if (key.length === 0) {
            continue;
          }
          zoneByDepartment.set(key, record);
        }

        const processedAreas = areasRes.data.map((area) => {
          const departments = area.Departments.map((department) => {
            const departmentCode = String(department.Department_Code);
            const zoneRecord = zoneByDepartment.get(departmentCode);
            const zoneCode = zoneRecord?.Zone_Code
              ? String(zoneRecord.Zone_Code)
              : departmentCode || null;
            const zoneName = zoneRecord?.Zone_Name ?? null;

            return {
              ...department,
              Department_Code: departmentCode,
              City_Name: department.City_Name ?? null,
              Area_Code: area.Area_Code,
              Area_Name: area.Area_Name,
              Zone_Code: zoneCode,
              Zone_Name: zoneName,
              Region_Code: zoneRecord?.Region_Code ?? null,
              Region_Name: zoneRecord?.Region_Name ?? null,
            } satisfies Department;
          });

          const totalSqm = departments.reduce(
            (sum, dept) => sum + (dept.SQM ?? 0),
            0
          );
          const geocodedCount = departments.filter(
            (dept) => dept.Longitude !== null && dept.Latitude !== null
          ).length;
          const zoneNames = Array.from(
            new Set(
              departments
                .map((dept) => (dept.Zone_Name ?? "").trim())
                .filter((name) => name.length > 0)
            )
          ).sort();

          return {
            code: area.Area_Code,
            name: area.Area_Name,
            type: "area" as const,
            cities: area.Cities.slice().sort((a, b) => a.localeCompare(b)),
            departments,
            zoneNames,
            storeCount: departments.length,
            totalSqm,
            geocodedCount,
          } satisfies SidebarAreaItem;
        });

        const zoneGroups: Map<string, ZoneGroup> = new Map();

        for (const record of zonesRes.data) {
          const baseCode = record.Zone_Code ?? record.Zone_Name;
          const zoneCodeRaw = String(baseCode ?? `zone-${record.Zone_Name}`).trim();
          const zoneCode = zoneCodeRaw.length > 0 ? zoneCodeRaw : `zone-${record.Zone_Name}`;
          const zoneName = record.Zone_Name?.trim() || "Unassigned zone";

          let group = zoneGroups.get(zoneCode);
          if (!group) {
            group = {
              code: zoneCode,
              name: zoneName,
              departments: [],
              cities: new Set<string>(),
              areas: new Set<string>(),
              regionNames: new Set<string>(),
              totalSqm: 0,
              geocodedCount: 0,
            };
            zoneGroups.set(zoneCode, group);
          }

          const department: Department = {
            Department_Code: zoneCode,
            Department_Name: zoneName,
            SQM: record.SQM,
            Longitude: record.Longitude,
            Latitude: record.Latitude,
            Adresse: record.Adresse,
            Format: record.Format,
            City_Name: record.City_Name,
            Area_Code: record.Area_Code,
            Area_Name: record.Area_Name,
            Zone_Code: zoneCode,
            Zone_Name: zoneName,
            Region_Code: record.Region_Code,
            Region_Name: record.Region_Name,
          };

          group.departments.push(department);
          if (record.City_Name) group.cities.add(record.City_Name);
          if (record.Area_Name) group.areas.add(record.Area_Name);
          if (record.Region_Name) group.regionNames.add(record.Region_Name);
          group.totalSqm += record.SQM ?? 0;
          if (record.Latitude !== null && record.Longitude !== null) {
            group.geocodedCount += 1;
          }
        }

        const zoneValues = Array.from(zoneGroups.values());
        const processedZones = sortByStoreCount(
          zoneValues.map((group): SidebarZoneItem => ({
            code: group.code,
            name: group.name,
            type: "zone",
            cities: Array.from(group.cities).sort((a, b) => a.localeCompare(b)),
            areas: Array.from(group.areas).sort((a, b) => a.localeCompare(b)),
            departments: group.departments,
            regionNames: Array.from(group.regionNames).sort((a, b) =>
              a.localeCompare(b)
            ),
            storeCount: group.departments.length,
            totalSqm: group.totalSqm,
            geocodedCount: group.geocodedCount,
          }))
        );

        const allDepartments = processedAreas.flatMap((area) => area.departments);
        const cityMetrics = new Map<
          string,
          {
            storeCount: number;
            totalSqm: number;
            areaNames: Set<string>;
            geocodedCount: number;
          }
        >();

        for (const department of allDepartments) {
          const cityName = department.City_Name?.trim();
          if (!cityName) {
            continue;
          }

          const key = normalizeKey(cityName);
          let metrics = cityMetrics.get(key);
          if (!metrics) {
            metrics = {
              storeCount: 0,
              totalSqm: 0,
              areaNames: new Set<string>(),
              geocodedCount: 0,
            };
            cityMetrics.set(key, metrics);
          }

          metrics.storeCount += 1;
          metrics.totalSqm += department.SQM ?? 0;
          if (department.Area_Name) {
            metrics.areaNames.add(department.Area_Name);
          }
          if (department.Longitude !== null && department.Latitude !== null) {
            metrics.geocodedCount += 1;
          }
        }

        const processedCities = sortByStoreCount(
          citiesRes.data.map((city) => {
            const metrics = cityMetrics.get(normalizeKey(city.City_Name));
            return {
              code: city.City_Code,
              name: city.City_Name,
              type: "city" as const,
              storeCount: metrics?.storeCount ?? 0,
              totalSqm: metrics?.totalSqm ?? 0,
              areaCount: metrics ? metrics.areaNames.size : 0,
              geocodedCount: metrics?.geocodedCount ?? 0,
            } satisfies SidebarCityItem;
          })
        );

        const storeMap = new Map<string, StoreData>();
        for (const department of allDepartments) {
          const key = String(department.Department_Code);
          if (!key || storeMap.has(key)) {
            continue;
          }

          storeMap.set(key, {
            Area_Code: department.Area_Code ?? "",
            Area_Name: department.Area_Name ?? "Unknown area",
            Department_Code: key,
            Department_Name: department.Department_Name,
            SQM: department.SQM,
            Longitude: department.Longitude,
            Latitude: department.Latitude,
            Adresse: department.Adresse,
            Format: department.Format,
            City_Name: department.City_Name ?? undefined,
            Zone_Code: department.Zone_Code ?? undefined,
            Zone_Name: department.Zone_Name ?? undefined,
          });
        }

        if (!cancelled) {
          setCityItems(processedCities);
          setAreaItems(sortByStoreCount(processedAreas));
          setZoneItems(processedZones);
          setStoresForMap(Array.from(storeMap.values()));
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load Viva Fresh insights. Please retry.");
          console.error("Failed to load Viva Fresh data", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
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
    const areaGeoCoverage =
      areaItem.storeCount > 0
        ? Math.round((areaItem.geocodedCount / areaItem.storeCount) * 100)
        : 0;
    const zoneChipLabel =
      areaItem.zoneNames.length === 0
        ? "Zone: Unassigned"
        : areaItem.zoneNames.length === 1
        ? `Zone: ${areaItem.zoneNames[0]}`
        : `${areaItem.zoneNames.length} zones`;
    const geoChipLabel =
      areaItem.storeCount > 0
        ? `Geo ${areaItem.geocodedCount}/${areaItem.storeCount} (${areaGeoCoverage}%)`
        : "Geo data pending";

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
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {areaItem.name}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip
              size="small"
              color="primary"
              label={`${areaItem.storeCount} ${
                areaItem.storeCount === 1 ? "store" : "stores"
              }`}
            />
            {areaItem.totalSqm > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${formatNumber.format(areaItem.totalSqm)} m²`}
              />
            )}
            <Chip size="small" variant="outlined" label={geoChipLabel} />
            <Chip size="small" variant="outlined" label={zoneChipLabel} />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            {areaItem.cities.length > 0
              ? `Cities: ${areaItem.cities.join(", ")}`
              : "No linked cities yet"}
          </Typography>
        </Box>

        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Viva Fresh locations
          </Typography>

          {areaItem.departments.map((department) => (
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
                    Store area:{" "}
                    {department.SQM != null
                      ? `${formatNumber.format(department.SQM)} m²`
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
                  {department.Zone_Name && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", display: "block" }}
                    >
                      Zone: {department.Zone_Name}
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
    const zoneGeoCoverage =
      zoneItem.storeCount > 0
        ? Math.round((zoneItem.geocodedCount / zoneItem.storeCount) * 100)
        : 0;
    const regionChipLabel =
      zoneItem.regionNames.length === 0
        ? "Region: Unassigned"
        : zoneItem.regionNames.length === 1
        ? `Region: ${zoneItem.regionNames[0]}`
        : `${zoneItem.regionNames.length} regions`;

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
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {zoneItem.name}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip
              size="small"
              color="primary"
              label={`${zoneItem.storeCount} ${
                zoneItem.storeCount === 1 ? "store" : "stores"
              }`}
            />
            {zoneItem.totalSqm > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${formatNumber.format(zoneItem.totalSqm)} m²`}
              />
            )}
            <Chip
              size="small"
              variant="outlined"
              label={`Geo ${zoneItem.geocodedCount}/${zoneItem.storeCount || 1} (${zoneGeoCoverage}%)`}
            />
            <Chip size="small" variant="outlined" label={regionChipLabel} />
          </Stack>
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
          {zoneItem.departments.map((department) => (
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
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  Store area:{" "}
                  {department.SQM != null
                    ? `${formatNumber.format(department.SQM)} m²`
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
        ? cityItems
        : filterMode === "area"
        ? areaItems
        : zoneItems;

    const listSummaryLabel =
      filterMode === "city"
        ? `${cityItems.length} cit${cityItems.length === 1 ? "y" : "ies"}`
        : filterMode === "area"
        ? `${areaItems.length} area${areaItems.length === 1 ? "" : "s"}`
        : `${zoneItems.length} zone${zoneItems.length === 1 ? "" : "s"}`;

    const getSecondaryText = (item: SidebarItem) => {
      if (item.type === "city") {
        const parts = [
          `${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`,
        ];
        if (item.areaCount > 0) {
          parts.push(`${item.areaCount} area${item.areaCount === 1 ? "" : "s"}`);
        }
        if (item.totalSqm > 0) {
          parts.push(`${formatNumber.format(item.totalSqm)} m²`);
        }
        if (item.storeCount > 0) {
          const coverage = Math.round(
            (item.geocodedCount / item.storeCount) * 100
          );
          parts.push(
            `Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`
          );
        }
        return parts.join(" • ");
      }

      if (item.type === "area") {
        const parts = [
          `${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`,
          `${item.cities.length} cit${item.cities.length === 1 ? "y" : "ies"}`,
        ];
        if (item.totalSqm > 0) {
          parts.push(`${formatNumber.format(item.totalSqm)} m²`);
        }
        if (item.storeCount > 0) {
          const coverage = Math.round(
            (item.geocodedCount / item.storeCount) * 100
          );
          parts.push(
            `Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`
          );
        }
        if (item.zoneNames.length > 0) {
          parts.push(
            item.zoneNames.length === 1
              ? `Zone ${item.zoneNames[0]}`
              : `${item.zoneNames.length} zones`
          );
        }
        return parts.join(" • ");
      }

      const parts = [
        `${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`,
        `${item.areas.length} area${item.areas.length === 1 ? "" : "s"}`,
      ];
      if (item.cities.length > 0) {
        parts.push(`${item.cities.length} cit${item.cities.length === 1 ? "y" : "ies"}`);
      }
      if (item.totalSqm > 0) {
        parts.push(`${formatNumber.format(item.totalSqm)} m²`);
      }
      if (item.storeCount > 0) {
        const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
        parts.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
      }
      if (item.regionNames.length > 0) {
        parts.push(
          item.regionNames.length === 1
            ? `Region ${item.regionNames[0]}`
            : `${item.regionNames.length} regions`
        );
      }
      return parts.join(" • ");
    };

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
          {!loading && (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mt: 0.75 }}
            >
              {listSummaryLabel}
            </Typography>
          )}
        </Box>

        <Box sx={{ px: 1, py: 1, flex: 1, overflowY: "auto" }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                justifyContent: "center",
                height: "100%",
              }}
            >
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Loading Viva Fresh network…
              </Typography>
            </Box>
          ) : error ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                textAlign: "center",
                height: "100%",
                px: 2,
              }}
            >
              <Typography variant="body2" color="error">
                {error}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Refresh the page once the API is back online.
              </Typography>
            </Box>
          ) : items.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No results available yet.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {items.map((item) => {
                const isSelected = selectedItem?.code === item.code;
                return (
                  <ListItemButton
                    key={item.code}
                    selected={isSelected}
                    onClick={() => handleSelect(item)}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      alignItems: "flex-start",
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "black",
                        "& .MuiListItemIcon-root": { color: "black" },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: "text.secondary", mt: 0.5 }}>
                  {filterMode === "city" ? (
                    <LocationCity />
                  ) : filterMode === "area" ? (
                    <MapIcon />
                  ) : (
                    <Layers />
                  )}
                    </ListItemIcon>
                    <ListItemText
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondaryTypographyProps={{
                        sx: {
                          color: isSelected ? "rgba(15,23,42,0.75)" : "text.secondary",
                        },
                      }}
                      primary={item.name}
                      secondary={getSecondaryText(item)}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
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
                    stores={storesForMap}
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
