import {
  Box,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from "@mui/material";
import { Layers, LocationCity, Map as MapIcon } from "@mui/icons-material";
import type { MouseEvent } from "react";

import type { FilterMode, SidebarItem } from "../../types/viva";
import { describeSidebarItem } from "../../utils/vivaTransformers";

type SidebarListProps = {
  filterMode: FilterMode;
  onFilterModeChange: (
    event: MouseEvent<HTMLElement>,
    value: FilterMode | null
  ) => void;
  items: SidebarItem[];
  selectedItem: SidebarItem | null;
  onSelectItem: (item: SidebarItem) => void;
  loading: boolean;
  error: string | null;
  summaryLabel: string;
};

const renderIcon = (mode: FilterMode) => {
  switch (mode) {
    case "city":
      return <LocationCity />;
    case "area":
      return <MapIcon />;
    case "zone":
    default:
      return <Layers />;
  }
};

export const SidebarList = ({
  filterMode,
  onFilterModeChange,
  items,
  selectedItem,
  onSelectItem,
  loading,
  error,
  summaryLabel,
}: SidebarListProps) => (
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
        onChange={onFilterModeChange}
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
          {summaryLabel}
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
                onClick={() => onSelectItem(item)}
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
                  {renderIcon(filterMode)}
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ fontWeight: 600 }}
                  secondaryTypographyProps={{
                    sx: {
                      color: isSelected
                        ? "rgba(15,23,42,0.75)"
                        : "text.secondary",
                    },
                  }}
                  primary={item.name}
                  secondary={describeSidebarItem(item)}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>

    <Divider sx={{ my: 1, borderColor: "divider" }} />
    <Box sx={{ px: 2, pb: 2 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
        © 2025 Viva Fresh
      </Typography>
    </Box>
  </Box>
);
