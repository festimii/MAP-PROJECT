import type { StoreData } from "./map";

export type FilterMode = "city" | "area" | "zone";

export interface City {
  City_Code: number;
  City_Name: string;
}

export interface Department {
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
  SubZone_Name?: string | null;
  SubZone_GeoJSON?: GeoJSON.GeoJsonObject | null;
}

export interface RawAreaResponse {
  Area_Code: string;
  Area_Name: string;
  Cities: string[];
  Departments: Department[];
}

export interface RawZoneRecord {
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
  SubZone_Name?: string | null;
  SubZone_GeoJSON?: GeoJSON.GeoJsonObject | null;
}

export interface SidebarCityItem {
  code: number;
  name: string;
  type: "city";
  storeCount: number;
  totalSqm: number;
  areaCount: number;
  geocodedCount: number;
}

export interface SidebarAreaItem {
  code: string;
  name: string;
  type: "area";
  cities: string[];
  departments: Department[];
  zoneNames: string[];
  storeCount: number;
  totalSqm: number;
  geocodedCount: number;
}

export interface SidebarZoneItem {
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
}

export type SidebarItem =
  | SidebarCityItem
  | SidebarAreaItem
  | SidebarZoneItem;

export interface VivaNetworkData {
  cities: City[];
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
  stores: StoreData[];
}
