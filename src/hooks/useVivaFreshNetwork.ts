import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import { buildApiUrl } from "../config/apiConfig";
import type {
  City,
  RawAreaResponse,
  RawZoneRecord,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarZoneItem,
} from "../models/viva";
import type { StoreData } from "../models/map";
import { buildVivaNetworkData } from "../utils/dataTransforms";

interface UseVivaFreshNetworkState {
  cities: City[];
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
  stores: StoreData[];
}

const initialState: UseVivaFreshNetworkState = {
  cities: [],
  cityItems: [],
  areaItems: [],
  zoneItems: [],
  stores: [],
};

const DATA_ERROR_MESSAGE = "Unable to load Viva Fresh insights. Please retry.";

export const useVivaFreshNetwork = () => {
  const [data, setData] = useState<UseVivaFreshNetworkState>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [citiesRes, areasRes, zonesRes] = await Promise.all([
        axios.get<City[]>(buildApiUrl("/cities")),
        axios.get<RawAreaResponse[]>(buildApiUrl("/areas/filters")),
        axios.get<RawZoneRecord[]>(buildApiUrl("/zones")),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const processed = buildVivaNetworkData(
        citiesRes.data,
        areasRes.data,
        zonesRes.data
      );

      setData({
        cities: citiesRes.data,
        ...processed,
      });
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      console.error("Failed to load Viva Fresh data", err);
      setError(DATA_ERROR_MESSAGE);
      setData(initialState);
      setLastUpdated(null);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  return {
    ...data,
    loading,
    error,
    lastUpdated,
    reload: loadData,
  };
};
