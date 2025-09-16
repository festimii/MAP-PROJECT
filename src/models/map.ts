export type MapSelection =
  | { mode: "city"; city: string }
  | { mode: "area"; area: string; cities: string[] }
  | { mode: "zone"; zone: string; cities: string[]; areas: string[] };

export interface StoreData {
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
}
