import type {
  City,
  Department,
  RawAreaResponse,
  RawZoneRecord,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarItem,
  SidebarZoneItem,
  StoreData,
} from "../types/viva";
import { formatNumber, normalizeKey, sortByStoreCount } from "./formatters";

export type VivaNetworkSummary = {
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
  stores: StoreData[];
};

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

const toCleanString = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const buildZoneGroups = (records: RawZoneRecord[]): Map<string, ZoneGroup> => {
  const groups = new Map<string, ZoneGroup>();

  for (const record of records) {
    const baseCode = record.Zone_Code ?? record.Zone_Name;
    const zoneCodeRaw = toCleanString(baseCode);
    const zoneCode = zoneCodeRaw.length > 0 ? zoneCodeRaw : `zone-${record.Zone_Name}`;
    const zoneName = record.Zone_Name?.trim() || "Unassigned zone";

    let group = groups.get(zoneCode);
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
      groups.set(zoneCode, group);
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
    if (record.City_Name) {
      group.cities.add(record.City_Name);
    }
    if (record.Area_Name) {
      group.areas.add(record.Area_Name);
    }
    if (record.Region_Name) {
      group.regionNames.add(record.Region_Name);
    }
    group.totalSqm += record.SQM ?? 0;
    if (record.Latitude !== null && record.Longitude !== null) {
      group.geocodedCount += 1;
    }
  }

  return groups;
};

const enrichDepartmentsWithZones = (
  areas: RawAreaResponse[],
  zones: RawZoneRecord[]
): SidebarAreaItem[] => {
  const zoneByDepartment = new Map<string, RawZoneRecord>();
  for (const record of zones) {
    const key = toCleanString(record.Zone_Code ?? record.Zone_Name);
    if (key.length > 0) {
      zoneByDepartment.set(key, record);
    }
  }

  return areas.map((area) => {
    const departments = area.Departments.map((department) => {
      const departmentCode = toCleanString(department.Department_Code);
      const zoneRecord = zoneByDepartment.get(departmentCode);
      const zoneCode = zoneRecord?.Zone_Code
        ? toCleanString(zoneRecord.Zone_Code)
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

    const totalSqm = departments.reduce((sum, dept) => sum + (dept.SQM ?? 0), 0);
    const geocodedCount = departments.filter(
      (dept) => dept.Longitude !== null && dept.Latitude !== null
    ).length;
    const zoneNames = Array.from(
      new Set(
        departments
          .map((dept) => toCleanString(dept.Zone_Name))
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
};

const collectCityMetrics = (departments: Department[]) => {
  const metrics = new Map<
    string,
    { storeCount: number; totalSqm: number; areaNames: Set<string>; geocodedCount: number }
  >();

  for (const department of departments) {
    const cityName = department.City_Name?.trim();
    if (!cityName) {
      continue;
    }

    const key = normalizeKey(cityName);
    let cityMetrics = metrics.get(key);
    if (!cityMetrics) {
      cityMetrics = {
        storeCount: 0,
        totalSqm: 0,
        areaNames: new Set<string>(),
        geocodedCount: 0,
      };
      metrics.set(key, cityMetrics);
    }

    cityMetrics.storeCount += 1;
    cityMetrics.totalSqm += department.SQM ?? 0;
    if (department.Area_Name) {
      cityMetrics.areaNames.add(department.Area_Name);
    }
    if (department.Longitude !== null && department.Latitude !== null) {
      cityMetrics.geocodedCount += 1;
    }
  }

  return metrics;
};

export const buildVivaNetworkSummary = (
  cities: City[],
  areas: RawAreaResponse[],
  zones: RawZoneRecord[]
): VivaNetworkSummary => {
  const processedAreas = enrichDepartmentsWithZones(areas, zones);
  const zoneGroups = buildZoneGroups(zones);

  const processedZones = sortByStoreCount(
    Array.from(zoneGroups.values()).map(
      (group): SidebarZoneItem => ({
        code: group.code,
        name: group.name,
        type: "zone",
        cities: Array.from(group.cities).sort((a, b) => a.localeCompare(b)),
        areas: Array.from(group.areas).sort((a, b) => a.localeCompare(b)),
        departments: group.departments,
        regionNames: Array.from(group.regionNames).sort((a, b) => a.localeCompare(b)),
        storeCount: group.departments.length,
        totalSqm: group.totalSqm,
        geocodedCount: group.geocodedCount,
      })
    )
  );

  const allDepartments = processedAreas.flatMap((area) => area.departments);
  const cityMetrics = collectCityMetrics(allDepartments);

  const processedCities = sortByStoreCount(
    cities.map(
      (city): SidebarCityItem => {
        const metrics = cityMetrics.get(normalizeKey(city.City_Name));
        return {
          code: city.City_Code,
          name: city.City_Name,
          type: "city" as const,
          storeCount: metrics?.storeCount ?? 0,
          totalSqm: metrics?.totalSqm ?? 0,
          areaCount: metrics ? metrics.areaNames.size : 0,
          geocodedCount: metrics?.geocodedCount ?? 0,
        };
      }
    )
  );

  const storeMap = new Map<string, StoreData>();
  for (const department of allDepartments) {
    const key = toCleanString(department.Department_Code);
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

  return {
    cityItems: processedCities,
    areaItems: sortByStoreCount(processedAreas),
    zoneItems: processedZones,
    stores: Array.from(storeMap.values()),
  };
};

export const summarizeItemsByMode = (
  mode: "city" | "area" | "zone",
  cityItems: SidebarCityItem[],
  areaItems: SidebarAreaItem[],
  zoneItems: SidebarZoneItem[]
) => {
  switch (mode) {
    case "city":
      return `${cityItems.length} cit${cityItems.length === 1 ? "y" : "ies"}`;
    case "area":
      return `${areaItems.length} area${areaItems.length === 1 ? "" : "s"}`;
    case "zone":
    default:
      return `${zoneItems.length} zone${zoneItems.length === 1 ? "" : "s"}`;
  }
};

export const describeSidebarItem = (item: SidebarItem): string => {
  const pieces: string[] = [];

  if (item.type === "city") {
    pieces.push(`${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`);
    if (item.areaCount > 0) {
      pieces.push(`${item.areaCount} area${item.areaCount === 1 ? "" : "s"}`);
    }
    if (item.totalSqm > 0) {
      pieces.push(`${formatNumber(item.totalSqm)} m²`);
    }
    if (item.storeCount > 0) {
      const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
      pieces.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
    }
    return pieces.join(" • ");
  }

  if (item.type === "area") {
    pieces.push(`${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`);
    pieces.push(`${item.cities.length} cit${item.cities.length === 1 ? "y" : "ies"}`);
    if (item.totalSqm > 0) {
      pieces.push(`${formatNumber(item.totalSqm)} m²`);
    }
    if (item.storeCount > 0) {
      const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
      pieces.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
    }
    if (item.zoneNames.length > 0) {
      pieces.push(
        item.zoneNames.length === 1
          ? `Zone ${item.zoneNames[0]}`
          : `${item.zoneNames.length} zones`
      );
    }
    return pieces.join(" • ");
  }

  pieces.push(`${item.storeCount} store${item.storeCount === 1 ? "" : "s"}`);
  pieces.push(`${item.areas.length} area${item.areas.length === 1 ? "" : "s"}`);
  if (item.cities.length > 0) {
    pieces.push(`${item.cities.length} cit${item.cities.length === 1 ? "y" : "ies"}`);
  }
  if (item.totalSqm > 0) {
    pieces.push(`${formatNumber(item.totalSqm)} m²`);
  }
  if (item.storeCount > 0) {
    const coverage = Math.round((item.geocodedCount / item.storeCount) * 100);
    pieces.push(`Geo ${item.geocodedCount}/${item.storeCount} (${coverage}%)`);
  }
  if (item.regionNames.length > 0) {
    pieces.push(
      item.regionNames.length === 1
        ? `Region ${item.regionNames[0]}`
        : `${item.regionNames.length} regions`
    );
  }

  return pieces.join(" • ");
};
