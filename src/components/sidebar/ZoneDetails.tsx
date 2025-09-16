import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import type { SidebarZoneItem } from "../../types/viva";
import { formatNumber } from "../../utils/formatters";

type ZoneDetailsProps = {
  zone: SidebarZoneItem;
  onBack: () => void;
};

export const ZoneDetails = ({ zone, onBack }: ZoneDetailsProps) => {
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
      <Toolbar />
      <Box sx={{ px: 2, py: 1 }}>
        <Button variant="outlined" size="small" onClick={onBack} sx={{ mb: 2 }}>
          ← Back to Zones
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {zone.name}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip
            size="small"
            color="primary"
            label={`${zone.storeCount} ${zone.storeCount === 1 ? "store" : "stores"}`}
          />
          {zone.totalSqm > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={`${formatNumber(zone.totalSqm)} m²`}
            />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`Geo ${zone.geocodedCount}/${zone.storeCount || 1} (${zoneGeoCoverage}%)`}
          />
          <Chip size="small" variant="outlined" label={regionChipLabel} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          Areas covered
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          {zone.areas.map((area) => (
            <Chip key={area} label={area} size="small" />
          ))}
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          Cities linked
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          {zone.cities.map((city) => (
            <Chip key={city} label={city} size="small" color="primary" />
          ))}
        </Box>
      </Box>

      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Stores in this zone
        </Typography>
        {zone.departments.map((department) => (
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
