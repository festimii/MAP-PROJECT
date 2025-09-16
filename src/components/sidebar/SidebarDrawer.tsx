import type { MouseEvent } from "react";

import type {
  FilterMode,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarItem,
  SidebarZoneItem,
} from "../../types/viva";
import { summarizeItemsByMode } from "../../utils/vivaTransformers";
import { AreaDetails } from "./AreaDetails";
import { SidebarList } from "./SidebarList";
import { ZoneDetails } from "./ZoneDetails";

type SidebarDrawerProps = {
  filterMode: FilterMode;
  onFilterModeChange: (
    event: MouseEvent<HTMLElement>,
    value: FilterMode | null
  ) => void;
  selectedItem: SidebarItem | null;
  onSelectItem: (item: SidebarItem) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
};

export const SidebarDrawer = ({
  filterMode,
  onFilterModeChange,
  selectedItem,
  onSelectItem,
  onBack,
  loading,
  error,
  cityItems,
  areaItems,
  zoneItems,
}: SidebarDrawerProps) => {
  const areaItem =
    filterMode === "area" && selectedItem?.type === "area" ? selectedItem : null;
  if (areaItem) {
    return <AreaDetails area={areaItem} onBack={onBack} />;
  }

  const zoneItem =
    filterMode === "zone" && selectedItem?.type === "zone" ? selectedItem : null;
  if (zoneItem) {
    return <ZoneDetails zone={zoneItem} onBack={onBack} />;
  }

  const items: SidebarItem[] =
    filterMode === "city" ? cityItems : filterMode === "area" ? areaItems : zoneItems;

  const summaryLabel = summarizeItemsByMode(
    filterMode,
    cityItems,
    areaItems,
    zoneItems
  );

  return (
    <SidebarList
      filterMode={filterMode}
      onFilterModeChange={onFilterModeChange}
      items={items}
      selectedItem={selectedItem}
      onSelectItem={onSelectItem}
      loading={loading}
      error={error}
      summaryLabel={summaryLabel}
    />
  );
};
