export type City = {
  City_Code: number;
  City_Name: string;
};

export type Department = {
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

export type RawAreaResponse = {
  Area_Code: string;
  Area_Name: string;
  Cities: string[];
  Departments: Department[];
};

export type RawZoneRecord = {
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

export type StoreData = {
  Area_Code: string;
  Area_Name: string;
  Zone_Code?: string | null;
  Zone_Name?: string | null;
  Department_Code: string;
  Department_Name: string;
  SQM: number | null;
  Longitude: number | null;
  Latitude: number | null;
  Adresse: string | null;
  Format: string | null;
  City_Name?: string;
};

export type SidebarCityItem = {
  code: number;
  name: string;
  type: "city";
  storeCount: number;
  totalSqm: number;
  areaCount: number;
  geocodedCount: number;
};

export type SidebarAreaItem = {
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

export type SidebarZoneItem = {
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

export type SidebarItem =
  | SidebarCityItem
  | SidebarAreaItem
  | SidebarZoneItem;

export type FilterMode = "city" | "area" | "zone";
