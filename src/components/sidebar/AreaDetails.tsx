import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import type { SidebarAreaItem } from "../../types/viva";
import { formatNumber } from "../../utils/formatters";

type AreaDetailsProps = {
  area: SidebarAreaItem;
  onBack: () => void;
};

export const AreaDetails = ({ area, onBack }: AreaDetailsProps) => {
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
      <Toolbar />
      <Box sx={{ px: 2, py: 1 }}>
        <Button variant="outlined" size="small" onClick={onBack} sx={{ mb: 2 }}>
          ← Back to Areas
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {area.name}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip
            size="small"
            color="primary"
            label={`${area.storeCount} ${area.storeCount === 1 ? "store" : "stores"}`}
          />
          {area.totalSqm > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={`${formatNumber(area.totalSqm)} m²`}
            />
          )}
          <Chip size="small" variant="outlined" label={geoChipLabel} />
          <Chip size="small" variant="outlined" label={zoneChipLabel} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          {area.cities.length > 0
            ? `Cities: ${area.cities.join(", ")}`
            : "No linked cities yet"}
        </Typography>
      </Box>

      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Viva Fresh locations
        </Typography>

        {area.departments.map((department) => (
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
