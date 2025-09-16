import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  Layers,
  LocationCity,
  Map as MapIcon,
} from "@mui/icons-material";

import type {
  FilterMode,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarItem,
  SidebarZoneItem,
} from "../../models/viva";
import { formatNumber } from "../../utils/format";

interface SidebarProps {
  filterMode: FilterMode;
  selectedItem: SidebarItem | null;
  onFilterModeChange: (mode: FilterMode) => void;
  onSelectItem: (item: SidebarItem) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
}

const getSecondaryText = (item: SidebarItem): string => {
  if (item.type === "city") {
    const parts = [`${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`];
    if (item.areaCount > 0) {
      parts.push(`${item.areaCount} area${item.areaCount === 1 ? "" : "s"}`);
    }
    if (item.totalSqm > 0) {
      parts.push(`${formatNumber(item.totalSqm)} m²`);
    }
    if (item.storeCount > 0) {
      const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
      parts.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
    }
    return parts.join(" • ");
  }

  if (item.type === "area") {
    const parts = [
      `${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`,
      `${item.cities.length} cit${item.cities.length === 1 ? "y" : "ies"}`,
    ];
    if (item.totalSqm > 0) {
      parts.push(`${formatNumber(item.totalSqm)} m²`);
    }
    if (item.storeCount > 0) {
      const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
      parts.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
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
    parts.push(`${formatNumber(item.totalSqm)} m²`);
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

const toolbarOffsetSx = { minHeight: { xs: 92, md: 104 } } as const;

const AreaDetail = ({ area, onBack }: { area: SidebarAreaItem; onBack: () => void }) => {
  const areaGeoCoverage =
    area.storeCount > 0
      ? Math.round((area.geocodedCount / area.storeCount) * 100)
      : 0;
  const zoneChipLabel =
    area.zoneNames.length === 0
      ? "Zone: Unassigned"
      : area.zoneNames.length === 1
      ? `Zone: ${area.zoneNames[0]}`
      : `${area.zoneNames.length} zones`;
  const geoChipLabel =
    area.storeCount > 0
      ? `Geo ${area.geocodedCount}/${area.storeCount} (${areaGeoCoverage}%)`
      : "Geo data pending";

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={toolbarOffsetSx} />
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          boxShadow: "0 18px 36px rgba(8, 15, 30, 0.35)",
        }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={onBack}
          sx={{ width: "fit-content" }}
        >
          ← Back to Areas
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {area.name}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            color="primary"
            label={`${area.storeCount} ${area.storeCount === 1 ? "store" : "stores"}`}
          />
          {area.totalSqm > 0 && (
            <Chip size="small" variant="outlined" label={`${formatNumber(area.totalSqm)} m²`} />
          )}
          <Chip size="small" variant="outlined" label={geoChipLabel} />
          <Chip size="small" variant="outlined" label={zoneChipLabel} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {area.cities.length > 0
            ? `Cities: ${area.cities.join(", ")}`
            : "No linked cities yet"}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "divider" }} />
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Viva Fresh locations
        </Typography>

        {area.departments.map((department) => (
          <Card
            key={department.Department_Code}
            variant="outlined"
            sx={{
              borderRadius: 3,
              transition: "all 0.2s ease",
              "&:hover": {
                boxShadow: "0 18px 32px rgba(8, 15, 30, 0.4)",
                borderColor: "rgba(59, 130, 246, 0.4)",
              },
            }}
          >
            <CardActionArea
              onClick={() => console.log("Selected department:", department)}
            >
              <CardContent>
                <Typography variant="body2" fontWeight="bold">
                  {department.Department_Name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  Store area: {" "}
                  {department.SQM != null
                    ? `${formatNumber(department.SQM)} m²`
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
};

const ZoneDetail = ({ zone, onBack }: { zone: SidebarZoneItem; onBack: () => void }) => {
  const zoneGeoCoverage =
    zone.storeCount > 0
      ? Math.round((zone.geocodedCount / zone.storeCount) * 100)
      : 0;
  const regionChipLabel =
    zone.regionNames.length === 0
      ? "Region: Unassigned"
      : zone.regionNames.length === 1
      ? `Region: ${zone.regionNames[0]}`
      : `${zone.regionNames.length} regions`;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={toolbarOffsetSx} />
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          boxShadow: "0 18px 36px rgba(8, 15, 30, 0.35)",
        }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={onBack}
          sx={{ width: "fit-content" }}
        >
          ← Back to Zones
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {zone.name}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            color="primary"
            label={`${zone.storeCount} ${zone.storeCount === 1 ? "store" : "stores"}`}
          />
          {zone.totalSqm > 0 && (
            <Chip size="small" variant="outlined" label={`${formatNumber(zone.totalSqm)} m²`} />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`Geo ${zone.geocodedCount}/${zone.storeCount || 1} (${zoneGeoCoverage}%)`}
          />
          <Chip size="small" variant="outlined" label={regionChipLabel} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Areas covered
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          {zone.areas.map((areaName) => (
            <Chip key={areaName} label={areaName} size="small" />
          ))}
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Cities linked
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          {zone.cities.map((city) => (
            <Chip key={city} label={city} size="small" color="primary" />
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: "divider" }} />
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Stores in this zone
        </Typography>
        {zone.departments.map((department) => (
          <Card
            key={`${department.Department_Code}-${department.Area_Code}`}
            variant="outlined"
            sx={{
              borderRadius: 3,
              transition: "all 0.2s ease",
              "&:hover": {
                boxShadow: "0 18px 32px rgba(8, 15, 30, 0.4)",
                borderColor: "rgba(59, 130, 246, 0.4)",
              },
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
                Store area: {" "}
                {department.SQM != null
                  ? `${formatNumber(department.SQM)} m²`
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
};

interface ListViewProps {
  filterMode: FilterMode;
  items: SidebarItem[];
  selectedItem: SidebarItem | null;
  onSelectItem: (item: SidebarItem) => void;
  onFilterModeChange: (mode: FilterMode) => void;
  loading: boolean;
  error: string | null;
  listSummaryLabel: string;
}

const ListView = ({
  filterMode,
  items,
  selectedItem,
  onSelectItem,
  onFilterModeChange,
  loading,
  error,
  listSummaryLabel,
}: ListViewProps) => {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toolbar sx={toolbarOffsetSx} />
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          boxShadow: "0 18px 36px rgba(8, 15, 30, 0.35)",
        }}
      >
        <ToggleButtonGroup
          value={filterMode}
          exclusive
          fullWidth
          onChange={(_, mode) => mode && onFilterModeChange(mode)}
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
            sx={{ color: "text.secondary", display: "block" }}
          >
            {listSummaryLabel}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 2.5, py: 2, flex: 1, overflowY: "auto" }}>
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
              const icon =
                item.type === "city" ? (
                  <LocationCity />
                ) : item.type === "area" ? (
                  <MapIcon />
                ) : (
                  <Layers />
                );

              return (
                <ListItemButton
                  key={item.code}
                  selected={isSelected}
                  onClick={() => onSelectItem(item)}
                  sx={{ alignItems: "flex-start" }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontWeight: 600 }}
                    secondaryTypographyProps={{
                      sx: {
                        color: isSelected
                          ? "rgba(15,23,42,0.72)"
                          : "text.secondary",
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

      <Divider sx={{ mx: 2.5, borderColor: "divider" }} />
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
          © 2025 Viva Fresh
        </Typography>
      </Box>
    </Box>
  );
};

const Sidebar = ({
  filterMode,
  selectedItem,
  onFilterModeChange,
  onSelectItem,
  onBack,
  loading,
  error,
  cityItems,
  areaItems,
  zoneItems,
}: SidebarProps) => {
  const areaItem =
    filterMode === "area" && selectedItem?.type === "area" ? selectedItem : null;
  const zoneItem =
    filterMode === "zone" && selectedItem?.type === "zone" ? selectedItem : null;

  if (areaItem) {
    return <AreaDetail area={areaItem} onBack={onBack} />;
  }

  if (zoneItem) {
    return <ZoneDetail zone={zoneItem} onBack={onBack} />;
  }

  const items =
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

  return (
    <ListView
      filterMode={filterMode}
      items={items}
      selectedItem={selectedItem}
      onSelectItem={onSelectItem}
      onFilterModeChange={onFilterModeChange}
      loading={loading}
      error={error}
      listSummaryLabel={listSummaryLabel}
    />
  );
};

export default Sidebar;
