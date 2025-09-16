import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "../api/client";
import type {
  City,
  RawAreaResponse,
  RawZoneRecord,
  SidebarAreaItem,
  SidebarCityItem,
  SidebarZoneItem,
  StoreData,
} from "../types/viva";
import { buildVivaNetworkSummary } from "../utils/vivaTransformers";

const ERROR_MESSAGE = "Unable to load Viva Fresh insights. Please retry.";

type VivaNetworkState = {
  loading: boolean;
  error: string | null;
  cities: City[];
  cityItems: SidebarCityItem[];
  areaItems: SidebarAreaItem[];
  zoneItems: SidebarZoneItem[];
  stores: StoreData[];
};

const initialState: VivaNetworkState = {
  loading: true,
  error: null,
  cities: [],
  cityItems: [],
  areaItems: [],
  zoneItems: [],
  stores: [],
};

export const useVivaNetworkData = () => {
  const [state, setState] = useState<VivaNetworkState>(initialState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadNetworkData = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const [citiesResponse, areasResponse, zonesResponse] = await Promise.all([
        apiClient.get<City[]>("/cities"),
        apiClient.get<RawAreaResponse[]>("/areas/filters"),
        apiClient.get<RawZoneRecord[]>("/zones"),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const summary = buildVivaNetworkSummary(
        citiesResponse.data,
        areasResponse.data,
        zonesResponse.data
      );

      setState({
        loading: false,
        error: null,
        cities: citiesResponse.data,
        cityItems: summary.cityItems,
        areaItems: summary.areaItems,
        zoneItems: summary.zoneItems,
        stores: summary.stores,
      });
    } catch (error) {
      console.error("Failed to load Viva Fresh data", error);
      if (!isMountedRef.current) {
        return;
      }

      setState((previous) => ({
        ...previous,
        loading: false,
        error: ERROR_MESSAGE,
      }));
    }
  }, []);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  return {
    ...state,
    refresh: loadNetworkData,
  };
};
