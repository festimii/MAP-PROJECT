import type {
  City,
  Department,
  RawAreaResponse,
  RawZoneRecord,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarZoneItem,
} from "../models/viva";
import type { StoreData } from "../models/map";
import { normalizeKey } from "./format";

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

const sortByStoreCount = <T extends { storeCount: number; name: string }>(
  list: T[]
) =>
  list
    .slice()
    .sort(
      (a, b) => b.storeCount - a.storeCount || a.name.localeCompare(b.name)
    );

const mapAreaDepartments = (
  area: RawAreaResponse,
  zoneByDepartment: Map<string, RawZoneRecord>
): Department[] =>
  area.Departments.map((department) => {
    const departmentCode = String(department.Department_Code ?? "").trim();
    const zoneRecord = departmentCode
      ? zoneByDepartment.get(departmentCode)
      : undefined;
    const zoneCode = zoneRecord?.Zone_Code
      ? String(zoneRecord.Zone_Code).trim()
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

const buildZoneGroups = (zones: RawZoneRecord[]): ZoneGroup[] => {
  const groups = new Map<string, ZoneGroup>();

  for (const record of zones) {
    const baseCode = record.Zone_Code ?? record.Zone_Name;
    const zoneCodeRaw = String(baseCode ?? `zone-${record.Zone_Name}`).trim();
    const zoneCode = zoneCodeRaw.length > 0 ? zoneCodeRaw : `zone-${record.Zone_Name}`;
    const zoneName = record.Zone_Name?.trim() || "Unassigned zone";
    const departmentCodeRaw = record.Department_Code ?? record.Zone_Code;
    const departmentCode = String(departmentCodeRaw ?? "").trim();
    const departmentName =
      record.Department_Name?.trim() ||
      record.Zone_Name?.trim() ||
      "Unassigned department";

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
      Department_Code: departmentCode.length > 0 ? departmentCode : zoneCode,
      Department_Name: departmentName,
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
      SubZone_Name: record.SubZone_Name ?? null,
      SubZone_GeoJSON: record.SubZone_GeoJSON ?? null,
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

  return Array.from(groups.values());
};

const buildZoneByDepartmentIndex = (
  zones: RawZoneRecord[]
): Map<string, RawZoneRecord> => {
  const index = new Map<string, RawZoneRecord>();
  for (const record of zones) {
    const rawKey = record.Department_Code ?? record.Zone_Code ?? record.Zone_Name;
    if (!rawKey) {
      continue;
    }
    const key = String(rawKey).trim();
    if (key.length === 0) {
      continue;
    }
    index.set(key, record);
  }
  return index;
};

const aggregateCityMetrics = (departments: Department[]) => {
  const metrics = new Map<
    string,
    {
      storeCount: number;
      totalSqm: number;
      areaNames: Set<string>;
      geocodedCount: number;
    }
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

const buildStoreDataset = (departments: Department[]): StoreData[] => {
  const storeMap = new Map<string, StoreData>();

  for (const department of departments) {
    const key = String(department.Department_Code ?? "").trim();
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
      SubZone_Name: department.SubZone_Name ?? null,
      SubZone_GeoJSON: department.SubZone_GeoJSON ?? null,
    });
  }

  return Array.from(storeMap.values());
};

export const buildVivaNetworkData = (
  cities: City[],
  areas: RawAreaResponse[],
  zones: RawZoneRecord[]
): {
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
  stores: StoreData[];
} => {
  const zoneIndex = buildZoneByDepartmentIndex(zones);

  const processedAreas = areas.map((area) => {
    const departments = mapAreaDepartments(area, zoneIndex);

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
    ).sort((a, b) => a.localeCompare(b));

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

  const zoneGroups = buildZoneGroups(zones);

  const processedZones = sortByStoreCount(
    zoneGroups.map((group): SidebarZoneItem => ({
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
  const cityMetrics = aggregateCityMetrics(allDepartments);

  const processedCities = sortByStoreCount(
    cities.map((city) => {
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

  const stores = buildStoreDataset(allDepartments);

  return {
    cityItems: processedCities,
    areaItems: sortByStoreCount(processedAreas),
    zoneItems: processedZones,
    stores,
  };
};
