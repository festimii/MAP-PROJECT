import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  AccessTime,
  Bolt,
  LocationCity,
  MapOutlined,
  ShoppingBag,
  TravelExplore,
  TrendingUp,
  Tune,
} from "@mui/icons-material";

import { buildApiUrl } from "../config/apiConfig";
import type { MapSelection, StoreData } from "../models/map";
import type { City } from "../models/viva";

type NearbyBusiness = {
  OSM_Id: number;
  Name: string;
  Category: string;
  Latitude: number;
  Longitude: number;
  Address: string | null;
};

type StoreWithBusinesses = StoreData & {
  NearbyBusinesses?: NearbyBusiness[];
};

type StoreFeatureProperties = {
  department: string;
  city: string;
  cityNormalized: string;
  area: string;
  areaNormalized: string;
  address: string | null;
  format: string | null;
  sqm: number;
  zone: string;
  zoneNormalized: string;
};

type ZoneApiStore = {
  Zone_Code: string | null;
  Zone_Name: string;
  Area_Code: string | null;
  Area_Name: string;
  City_Name: string | null;
  SQM: number | null;
  Longitude: number | null;
  Latitude: number | null;
  Adresse: string | null;
  Format: string | null;
  SubZone_Name: string | null;
  SubZone_GeoJSON: GeoJSON.GeoJsonObject | null;
};

type BusinessProperties = {
  id: number;
  name: string;
  category: string;
  categoryLabel: string;
  address: string | null;
  storeDepartment: string;
  areaName: string;
  cityName?: string;
};

type PopulationFeatureProperties = {
  id?: string | number;
  population?: number;
  population_density?: number;
};

type StoreFocus = {
  department: string;
  coordinates: [number, number];
};

type SubZoneFeatureProperties = {
  department: string;
  departmentCode: string;
  departmentNormalized: string;
  zone: string;
  zoneNormalized: string;
};

type SelectionKpiMetric = {
  label: string;
  value: string;
  helper: string;
};

type SelectionKpiData = {
  summary: {
    opportunityScore: number;
    momentumIndex: number;
    yoyTrend: number;
    primaryFocus: string;
    secondaryFocus: string;
  };
  dwellTime: number;
  avgBasket: number;
  network: SelectionKpiMetric[];
  shopper: SelectionKpiMetric[];
  operations: SelectionKpiMetric[];
  sustainability: SelectionKpiMetric[];
};

const normalizeName = (value: string) => value.toLowerCase().trim();

type PopulationOverlayStats = {
  cellCount: number;
  totalPopulation: number;
  maxPopulation: number;
};

type MapViewProps = {
  selection: MapSelection | null;
  cities: City[];
  stores?: StoreData[];
};

const humanizeCategory = (value: string) =>
  value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Other";

const DEFAULT_COMPETITION_CATEGORY = "all";
const STORE_LABEL_VISIBILITY_ZOOM = 13;
const COMPETITION_LABEL_VISIBILITY_ZOOM = 13;
const POPULATION_SOURCE_ID = "population-density";
const POPULATION_FILL_LAYER_ID = "population-density-fill";
const POPULATION_OUTLINE_LAYER_ID = "population-density-outline";
const POPULATION_DATA_URL = "data/kontur_population.json";

const createStoreBaseFilter = (): FilterSpecification =>
  ["!has", "point_count"] as unknown as FilterSpecification;

const createEmptyStoreHighlightFilter = (): FilterSpecification =>
  [
    "all",
    ["!has", "point_count"],
    ["==", "department", "__none__"],
  ] as unknown as FilterSpecification;

const getStoreSelectionFilterContext = (
  selectionValue: MapSelection | null,
  storeFocus: StoreFocus | null
): {
  highlightFilter: FilterSpecification;
  displayFilter: FilterSpecification;
  highlightEnabled: boolean;
  cityNames: string[];
} => {
  if (!selectionValue) {
    if (storeFocus) {
      return {
        highlightFilter: [
          "all",
          ["!has", "point_count"],
          ["==", "department", storeFocus.department],
        ] as unknown as FilterSpecification,
        displayFilter: createStoreBaseFilter(),
        highlightEnabled: true,
        cityNames: [],
      };
    }

    return {
      highlightFilter: createEmptyStoreHighlightFilter(),
      displayFilter: createStoreBaseFilter(),
      highlightEnabled: false,
      cityNames: [],
    };
  }

  switch (selectionValue.mode) {
    case "city": {
      const filter = [
        "all",
        ["!has", "point_count"],
        ["==", "cityNormalized", normalizeName(selectionValue.city)],
      ] as unknown as FilterSpecification;
      return {
        highlightFilter: filter,
        displayFilter: filter,
        highlightEnabled: true,
        cityNames: [selectionValue.city],
      };
    }
    case "area": {
      const filter = [
        "all",
        ["!has", "point_count"],
        ["==", "areaNormalized", normalizeName(selectionValue.area)],
      ] as unknown as FilterSpecification;
      return {
        highlightFilter: filter,
        displayFilter: filter,
        highlightEnabled: true,
        cityNames: selectionValue.cities,
      };
    }
    case "zone": {
      const filter = [
        "all",
        ["!has", "point_count"],
        ["==", "zoneNormalized", normalizeName(selectionValue.zone)],
      ] as unknown as FilterSpecification;
      return {
        highlightFilter: filter,
        displayFilter: filter,
        highlightEnabled: true,
        cityNames: selectionValue.cities,
      };
    }
    default:
      return {
        highlightFilter: createEmptyStoreHighlightFilter(),
        displayFilter: createStoreBaseFilter(),
        highlightEnabled: false,
        cityNames: [],
      };
  }
};

const toGeoJsonObject = (value: unknown): GeoJSON.GeoJsonObject | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as GeoJSON.GeoJsonObject;
    } catch (err) {
      console.warn("Failed to parse subzone GeoJSON", err);
      return null;
    }
  }

  if (typeof value === "object") {
    return value as GeoJSON.GeoJsonObject;
  }

  return null;
};

const collectSubZoneGeometries = (value: unknown): GeoJSON.Geometry[] => {
  const geoJson = toGeoJsonObject(value);
  if (!geoJson) {
    return [];
  }

  switch (geoJson.type) {
    case "FeatureCollection": {
      const featureCollection = geoJson as GeoJSON.FeatureCollection<
        GeoJSON.Geometry,
        GeoJSON.GeoJsonProperties
      >;
      return (
        featureCollection.features
          ?.filter((feature): feature is GeoJSON.Feature<GeoJSON.Geometry> =>
            Boolean(feature?.geometry)
          )
          .map((feature) => feature.geometry) ?? []
      );
    }
    case "Feature": {
      const feature = geoJson as GeoJSON.Feature<GeoJSON.Geometry>;
      return feature.geometry ? [feature.geometry] : [];
    }
    case "GeometryCollection": {
      const geometryCollection = geoJson as GeoJSON.GeometryCollection;
      return (
        geometryCollection.geometries?.filter(
          (geometry): geometry is GeoJSON.Geometry => Boolean(geometry)
        ) ?? []
      );
    }
    default:
      return [geoJson as GeoJSON.Geometry];
  }
};

const buildSubzoneFeatureCollection = (
  stores: StoreData[]
): GeoJSON.FeatureCollection<GeoJSON.Geometry, SubZoneFeatureProperties> => {
  const features: GeoJSON.Feature<
    GeoJSON.Geometry,
    SubZoneFeatureProperties
  >[] = [];

  for (const store of stores) {
    const geometries = collectSubZoneGeometries(store.SubZone_GeoJSON);
    if (!geometries.length) {
      continue;
    }

    const zoneName =
      store.Zone_Name ?? store.Department_Name ?? "Unassigned Zone";
    const zoneNormalized = normalizeName(zoneName);
    const departmentNormalized = normalizeName(store.Department_Name);

    for (const geometry of geometries) {
      features.push({
        type: "Feature",
        geometry,
        properties: {
          department: store.Department_Name,
          departmentCode: store.Department_Code,
          departmentNormalized,
          zone: zoneName,
          zoneNormalized,
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const buildStoreFeatureCollection = (
  stores: StoreData[]
): GeoJSON.FeatureCollection<GeoJSON.Point, StoreFeatureProperties> => {
  const features: GeoJSON.Feature<GeoJSON.Point, StoreFeatureProperties>[] = [];

  for (const store of stores) {
    if (store.Longitude === null || store.Latitude === null) {
      continue;
    }

    const areaName = store.Area_Name ?? "Unknown area";
    const fallbackCity =
      store.City_Name && store.City_Name.trim().length > 0
        ? store.City_Name
        : areaName.replace(/ Area$/i, "");
    const zoneName = store.Zone_Name ?? "Unassigned Zone";

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [store.Longitude, store.Latitude],
      },
      properties: {
        department: store.Department_Name,
        city: fallbackCity,
        cityNormalized: normalizeName(fallbackCity),
        area: areaName,
        areaNormalized: normalizeName(areaName),
        address: store.Adresse ?? null,
        format: store.Format ?? null,
        sqm: store.SQM ?? 0,
        zone: zoneName,
        zoneNormalized: normalizeName(zoneName),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

export default function MapView({ selection, cities, stores }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const navigate = useNavigate();
  const [darkMode] = useState(false);
  const businessFeaturesRef = useRef<
    GeoJSON.Feature<GeoJSON.Point, BusinessProperties>[]
  >([]);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    DEFAULT_COMPETITION_CATEGORY
  );
  const selectedCategoryRef = useRef(selectedCategory);
  const categorySelectionWasUserDriven = useRef(false);
  const [focusedStore, setFocusedStore] = useState<StoreFocus | null>(null);
  const storeFocusRef = useRef<StoreFocus | null>(null);
  const cityGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const cityNameKeyRef = useRef<string | null>(null);
  const selectionRef = useRef<MapSelection | null>(null);
  const [storesData, setStoresData] = useState<StoreData[]>(stores ?? []);
  const initialStoresRef = useRef<StoreData[] | undefined>(stores);
  const previousSelectionHadValue = useRef(false);
  const [populationOverlayEnabled, setPopulationOverlayEnabled] =
    useState(false);
  const [populationOverlayLoading, setPopulationOverlayLoading] =
    useState(false);
  const [populationOverlayError, setPopulationOverlayError] = useState<
    string | null
  >(null);
  const [populationOverlayAvailable, setPopulationOverlayAvailable] =
    useState(false);
  const [populationOverlayOpacity, setPopulationOverlayOpacity] = useState(0.6);
  const [populationOverlayStats, setPopulationOverlayStats] =
    useState<PopulationOverlayStats | null>(null);
  const populationOverlayEnabledRef = useRef(populationOverlayEnabled);
  const populationOverlayOpacityRef = useRef(populationOverlayOpacity);

  const filterBusinessFeaturesBySelection = useCallback(
    (
      features: GeoJSON.Feature<GeoJSON.Point, BusinessProperties>[],
      selectionValue: MapSelection | null,
      storeFocus: StoreFocus | null
    ) => {
      if (features.length === 0) {
        return features;
      }

      if (selectionValue) {
        switch (selectionValue.mode) {
          case "city": {
            const targetCity = normalizeName(selectionValue.city);
            return features.filter((feature) => {
              const props = feature.properties;
              if (!props) return false;
              const cityCandidate =
                props.cityName && props.cityName.trim().length > 0
                  ? normalizeName(props.cityName)
                  : props.areaName
                  ? normalizeName(props.areaName.replace(/ Area$/i, ""))
                  : null;
              if (cityCandidate && cityCandidate === targetCity) {
                return true;
              }
              const areaCandidate = props.areaName
                ? normalizeName(props.areaName)
                : null;
              return areaCandidate === targetCity;
            });
          }
          case "area": {
            const targetArea = normalizeName(selectionValue.area);
            return features.filter((feature) => {
              const areaCandidate = feature.properties?.areaName
                ? normalizeName(feature.properties.areaName)
                : null;
              return areaCandidate === targetArea;
            });
          }
          case "zone": {
            const allowedAreas = new Set(
              selectionValue.areas.map((area) => normalizeName(area))
            );
            const allowedCities = new Set(
              selectionValue.cities.map((city) => normalizeName(city))
            );
            return features.filter((feature) => {
              const props = feature.properties;
              if (!props) return false;
              const areaCandidate = props.areaName
                ? normalizeName(props.areaName)
                : null;
              if (areaCandidate && allowedAreas.has(areaCandidate)) {
                return true;
              }
              const cityCandidate =
                props.cityName && props.cityName.trim().length > 0
                  ? normalizeName(props.cityName)
                  : props.areaName
                  ? normalizeName(props.areaName.replace(/ Area$/i, ""))
                  : null;
              if (cityCandidate && allowedCities.has(cityCandidate)) {
                return true;
              }
              return false;
            });
          }
          default:
            return features;
        }
      }

      if (storeFocus) {
        return features.filter(
          (feature) =>
            feature.properties?.storeDepartment === storeFocus.department
        );
      }

      return [];
    },
    []
  );

  const updateStoreFocus = useCallback((nextFocus: StoreFocus | null) => {
    const current = storeFocusRef.current;

    if (current && nextFocus) {
      if (
        current.department === nextFocus.department &&
        current.coordinates[0] === nextFocus.coordinates[0] &&
        current.coordinates[1] === nextFocus.coordinates[1]
      ) {
        return;
      }
    }

    if (!current && !nextFocus) {
      return;
    }

    storeFocusRef.current = nextFocus;
    setFocusedStore(nextFocus);
  }, []);

  const refreshBusinessCategoryState = useCallback(
    (selectionValue: MapSelection | null, storeFocus: StoreFocus | null) => {
      const relevantFeatures = filterBusinessFeaturesBySelection(
        businessFeaturesRef.current,
        selectionValue,
        storeFocus
      );

      const uniqueCategories = Array.from(
        new Set(relevantFeatures.map((feature) => feature.properties.category))
      ).sort();

      setBusinessCategories(uniqueCategories);

      const currentCategory = selectedCategoryRef.current;
      let nextCategory = currentCategory;
      const hasCurrentCategory =
        currentCategory === DEFAULT_COMPETITION_CATEGORY ||
        uniqueCategories.includes(currentCategory);

      if (uniqueCategories.length === 0) {
        nextCategory = DEFAULT_COMPETITION_CATEGORY;
      } else if (!hasCurrentCategory) {
        nextCategory = DEFAULT_COMPETITION_CATEGORY;
      } else if (
        !categorySelectionWasUserDriven.current &&
        currentCategory !== DEFAULT_COMPETITION_CATEGORY
      ) {
        nextCategory = DEFAULT_COMPETITION_CATEGORY;
      }

      if (nextCategory !== currentCategory) {
        categorySelectionWasUserDriven.current = false;
        setSelectedCategory(nextCategory);
      }

      if (uniqueCategories.length === 0) {
        categorySelectionWasUserDriven.current = false;
      }

      return nextCategory;
    },
    [filterBusinessFeaturesBySelection]
  );

  const updateBusinessSource = useCallback(
    (map: MapLibreMap, category: string) => {
      const source = map.getSource(
        "businesses"
      ) as maplibregl.GeoJSONSource | null;
      if (!source) {
        return;
      }

      const selectionValue = selectionRef.current;
      const storeFocus = storeFocusRef.current;
      const relevantFeatures = filterBusinessFeaturesBySelection(
        businessFeaturesRef.current,
        selectionValue,
        storeFocus
      );

      const filtered =
        category === DEFAULT_COMPETITION_CATEGORY
          ? relevantFeatures
          : relevantFeatures.filter(
              (feature) => feature.properties.category === category
            );

      const featureCollection: GeoJSON.FeatureCollection<
        GeoJSON.Point,
        BusinessProperties
      > = {
        type: "FeatureCollection",
        features: filtered,
      };

      source.setData(featureCollection);
    },
    [filterBusinessFeaturesBySelection]
  );

  const applySelectionToMap = useCallback(() => {
    const map = mapRef.current;
    const nameKey = cityNameKeyRef.current;
    const geojson = cityGeoJSONRef.current;
    if (!map || !nameKey) {
      return;
    }

    const hasCityLayer = Boolean(map.getLayer("city-boundaries"));
    const hasHighlightLayer = Boolean(map.getLayer("city-highlight"));
    if (!hasCityLayer || !hasHighlightLayer) {
      return;
    }

    const selectionValue = selectionRef.current;
    const storeFocus = storeFocusRef.current;
    const {
      highlightFilter: storeHighlightFilter,
      displayFilter: storeDisplayFilter,
      highlightEnabled: storeHighlightEnabled,
      cityNames: selectedCityNames,
    } = getStoreSelectionFilterContext(selectionValue, storeFocus);

    const cleanedNames = Array.from(
      new Set(
        selectedCityNames
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      )
    );
    const hasCitySelection = cleanedNames.length > 0 && Boolean(selectionValue);

    const cityHighlightFilter: FilterSpecification = hasCitySelection
      ? (["in", nameKey, ...cleanedNames] as unknown as FilterSpecification)
      : (["in", nameKey, ""] as unknown as FilterSpecification);

    const storeHighlightVisibility = storeHighlightEnabled ? "visible" : "none";
    const cityHighlightVisibility = selectionValue ? "visible" : "none";

    const zoomLevel = map.getZoom();
    const showAllStoreLabels = zoomLevel >= STORE_LABEL_VISIBILITY_ZOOM;
    const storeLabelFilter = showAllStoreLabels
      ? storeDisplayFilter
      : storeHighlightFilter;
    const showCompetitionLabels =
      zoomLevel >= COMPETITION_LABEL_VISIBILITY_ZOOM;

    const subzoneLayerId = "subzone-highlight";
    const hasSubzoneLayer = Boolean(map.getLayer(subzoneLayerId));
    const targetSubzoneNormalized = storeFocus
      ? normalizeName(storeFocus.department)
      : selectionValue && selectionValue.mode === "zone"
      ? normalizeName(selectionValue.zone)
      : null;

    if (map.getLayer("store-points")) {
      map.setFilter("store-points", storeDisplayFilter);
      map.setPaintProperty(
        "store-points",
        "circle-opacity",
        storeHighlightEnabled ? 0.55 : 0.8
      );
      map.setPaintProperty(
        "store-points",
        "circle-color",
        storeHighlightEnabled ? "#fb7185" : "#ef4444"
      );
    }

    map.setFilter("city-highlight", cityHighlightFilter);

    if (hasSubzoneLayer) {
      if (targetSubzoneNormalized) {
        map.setFilter(subzoneLayerId, [
          "==",
          "zoneNormalized",
          targetSubzoneNormalized,
        ]);
        map.setLayoutProperty(subzoneLayerId, "visibility", "visible");
      } else {
        map.setFilter(subzoneLayerId, ["==", "zoneNormalized", "__none__"]);
        map.setLayoutProperty(subzoneLayerId, "visibility", "none");
      }
    }

    const boundaryOpacityExpression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      6,
      hasCitySelection ? 0.45 : 0.28,
      8.5,
      hasCitySelection ? 0.32 : 0.2,
      10.5,
      0,
    ] as unknown as ExpressionSpecification;

    if (hasCitySelection) {
      map.setPaintProperty("city-boundaries", "fill-color", [
        "case",
        ["in", ["get", nameKey], ["literal", cleanedNames]],
        "#1d4ed8",
        "#4b5563",
      ] as ExpressionSpecification);
      map.setPaintProperty(
        "city-boundaries",
        "fill-opacity",
        boundaryOpacityExpression
      );
    } else {
      map.setPaintProperty("city-boundaries", "fill-color", "#4b5563");
      map.setPaintProperty(
        "city-boundaries",
        "fill-opacity",
        boundaryOpacityExpression
      );
    }

    const highlightLayerExists = Boolean(
      map.getLayer("store-points-highlight")
    );
    if (highlightLayerExists) {
      map.setFilter("store-points-highlight", storeHighlightFilter);
      map.setLayoutProperty(
        "store-points-highlight",
        "visibility",
        storeHighlightVisibility
      );
    }

    if (map.getLayer("store-labels")) {
      map.setFilter("store-labels", storeLabelFilter);
      map.setLayoutProperty(
        "store-labels",
        "visibility",
        showAllStoreLabels ? "visible" : "none"
      );
    }

    if (map.getLayer("business-labels")) {
      map.setLayoutProperty(
        "business-labels",
        "visibility",
        showCompetitionLabels ? "visible" : "none"
      );
    }

    if (map.getLayer("city-highlight")) {
      map.setLayoutProperty(
        "city-highlight",
        "visibility",
        cityHighlightVisibility
      );
      const highlightOpacityExpression = selectionValue
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            0.75,
            8.5,
            0.6,
            10.5,
            0,
          ] as unknown as ExpressionSpecification)
        : 0;
      map.setPaintProperty(
        "city-highlight",
        "fill-extrusion-opacity",
        highlightOpacityExpression
      );
    }

    if (selectionValue && hasCitySelection && geojson) {
      const matchingFeatures = geojson.features.filter((feature) => {
        const value = feature.properties?.[nameKey];
        return typeof value === "string" && cleanedNames.includes(value.trim());
      });

      const coordinates: [number, number][] = [];
      for (const feature of matchingFeatures) {
        if (!feature.geometry) continue;
        if (feature.geometry.type === "Polygon") {
          for (const ring of feature.geometry.coordinates) {
            for (const coord of ring) {
              coordinates.push(coord as [number, number]);
            }
          }
        } else if (feature.geometry.type === "MultiPolygon") {
          for (const polygon of feature.geometry.coordinates) {
            for (const ring of polygon) {
              for (const coord of ring) {
                coordinates.push(coord as [number, number]);
              }
            }
          }
        }
      }

      if (coordinates.length) {
        let minLng = coordinates[0][0];
        let maxLng = coordinates[0][0];
        let minLat = coordinates[0][1];
        let maxLat = coordinates[0][1];

        for (const [lng, lat] of coordinates) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: 60,
            duration: 1200,
            maxZoom: 11.5,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          }
        );
        previousSelectionHadValue.current = true;
      }
    } else if (selectionValue && !hasCitySelection) {
      previousSelectionHadValue.current = true;
    } else if (
      !selectionValue &&
      !storeFocus &&
      previousSelectionHadValue.current
    ) {
      map.easeTo({
        center: [21, 42.6],
        zoom: 7.5,
        pitch: 0,
        bearing: 0,
        duration: 900,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
      previousSelectionHadValue.current = false;
    }
  }, []);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    updateStoreFocus(null);
  }, [selection, updateStoreFocus]);

  useEffect(() => {
    storeFocusRef.current = focusedStore;
    selectionRef.current = selection;
    applySelectionToMap();

    const map = mapRef.current;
    const nextCategory = refreshBusinessCategoryState(selection, focusedStore);

    if (!map) {
      return;
    }

    const runUpdate = () => {
      const categoryToUse = nextCategory ?? selectedCategoryRef.current;
      updateBusinessSource(map, categoryToUse);
    };

    if (!map.isStyleLoaded()) {
      map.once("load", runUpdate);
      return;
    }

    runUpdate();
  }, [
    selection,
    focusedStore,
    applySelectionToMap,
    refreshBusinessCategoryState,
    updateBusinessSource,
  ]);

  useEffect(() => {
    if (stores === undefined) {
      return;
    }

    setStoresData(stores);

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const updateSource = () => {
      const storeSource = map.getSource(
        "stores"
      ) as maplibregl.GeoJSONSource | null;
      if (storeSource) {
        storeSource.setData(buildStoreFeatureCollection(stores));
      }

      const subzoneSource = map.getSource(
        "subzones"
      ) as maplibregl.GeoJSONSource | null;
      if (subzoneSource) {
        subzoneSource.setData(buildSubzoneFeatureCollection(stores));
      }

      applySelectionToMap();
    };

    if (!map.isStyleLoaded()) {
      map.once("load", updateSource);
      return;
    }

    updateSource();
  }, [stores, applySelectionToMap]);

  // Initial map setup
  useEffect(() => {
    if (!mapContainer.current) return;

    businessFeaturesRef.current = [];
    setBusinessCategories([]);
    categorySelectionWasUserDriven.current = false;
    setSelectedCategory(DEFAULT_COMPETITION_CATEGORY);
    selectedCategoryRef.current = DEFAULT_COMPETITION_CATEGORY;

    const styleUrl = darkMode
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    const map: MapLibreMap = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [21, 42.6],
      zoom: 7.5,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;
    let isMounted = true;

    // Controls
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left"
    );

    map.on("load", async () => {
      try {
        // --- City polygons ---
        const res = await fetch("/kosovo-cities.geojson");
        if (!res.ok) {
          console.error("Failed to load kosovo-cities.geojson");
          return;
        }
        const geojson = await res.json();

        const nameKey = geojson.features[0].properties.VARNAME_2
          ? "VARNAME_2"
          : geojson.features[0].properties.NAME_2
          ? "NAME_2"
          : geojson.features[0].properties.NAME
          ? "NAME"
          : Object.keys(geojson.features[0].properties)[0];

        map.addSource("kosovo-cities", { type: "geojson", data: geojson });

        cityGeoJSONRef.current = geojson;
        cityNameKeyRef.current = nameKey;

        const cityColorExpression = [
          "match",
          ["get", nameKey],
          ...cities.flatMap((city) => [city.City_Name, "#4b5563"]),
          "#4b5563",
        ] as unknown as ExpressionSpecification;

        map.addLayer({
          id: "city-boundaries",
          type: "fill",
          source: "kosovo-cities",
          paint: { "fill-color": cityColorExpression, "fill-opacity": 0.35 },
        });

        map.addLayer(
          {
            id: "city-hover",
            type: "fill",
            source: "kosovo-cities",
            paint: { "fill-color": "#3b82f6", "fill-opacity": 0 },
            filter: ["==", ["get", nameKey], ""],
          },
          "city-boundaries"
        );

        map.addLayer({
          id: "city-borders",
          type: "line",
          source: "kosovo-cities",
          paint: { "line-color": "#111827", "line-width": 1.2 },
        });

        map.addLayer({
          id: "city-highlight",
          type: "fill-extrusion",
          source: "kosovo-cities",
          paint: {
            "fill-extrusion-color": "#facc15",
            "fill-extrusion-opacity": 0.8,
            "fill-extrusion-height": 500,
            "fill-extrusion-base": 0,
          },
          filter: ["in", nameKey, ""],
        });

        map.addLayer({
          id: "city-labels",
          type: "symbol",
          source: "kosovo-cities",
          layout: {
            "text-field": ["get", nameKey],
            "text-size": 14,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#111827",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });

        setPopulationOverlayAvailable(false);
        setPopulationOverlayError(null);
        setPopulationOverlayLoading(true);
        try {
          const populationResponse = await fetch(POPULATION_DATA_URL);
          if (!populationResponse.ok) {
            throw new Error(
              `Failed to load population data (${populationResponse.status})`
            );
          }

          const populationData =
            (await populationResponse.json()) as GeoJSON.FeatureCollection<
              GeoJSON.Polygon | GeoJSON.MultiPolygon,
              PopulationFeatureProperties
            >;

          map.addSource(POPULATION_SOURCE_ID, {
            type: "geojson",
            data: populationData,
          });

          map.addLayer(
            {
              id: POPULATION_FILL_LAYER_ID,
              type: "fill",
              source: POPULATION_SOURCE_ID,
              layout: {
                visibility: populationOverlayEnabledRef.current
                  ? "visible"
                  : "none",
              },
              paint: {
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "population"], 0],
                  0,
                  "rgba(15, 23, 42, 0)",
                  200,
                  "#fef3c7",
                  600,
                  "#fde68a",
                  1200,
                  "#fbbf24",
                  2000,
                  "#f97316",
                  3500,
                  "#c2410c",
                ] as unknown as ExpressionSpecification,
                "fill-opacity": populationOverlayEnabledRef.current
                  ? populationOverlayOpacityRef.current
                  : 0,
                "fill-outline-color": "rgba(17, 24, 39, 0.2)",
              },
            },
            "city-boundaries"
          );

          map.addLayer(
            {
              id: POPULATION_OUTLINE_LAYER_ID,
              type: "line",
              source: POPULATION_SOURCE_ID,
              layout: {
                visibility: populationOverlayEnabledRef.current
                  ? "visible"
                  : "none",
              },
              paint: {
                "line-color": "rgba(15, 23, 42, 0.35)",
                "line-width": 0.6,
              },
            },
            "city-boundaries"
          );

          if (isMounted) {
            const stats = populationData.features.reduce(
              (acc, feature) => {
                const population = Number(feature.properties?.population) || 0;
                return {
                  cellCount: acc.cellCount + 1,
                  totalPopulation: acc.totalPopulation + population,
                  maxPopulation: Math.max(acc.maxPopulation, population),
                };
              },
              { cellCount: 0, totalPopulation: 0, maxPopulation: 0 }
            );

            setPopulationOverlayStats(stats);
            setPopulationOverlayAvailable(true);
            setPopulationOverlayError(null);
          }
        } catch (populationError) {
          console.error(
            "Failed to load population density overlay:",
            populationError
          );
          if (isMounted) {
            setPopulationOverlayError(
              "Population density overlay could not be loaded."
            );
            setPopulationOverlayAvailable(false);
            setPopulationOverlayStats(null);
          }
        } finally {
          if (isMounted) {
            setPopulationOverlayLoading(false);
          }
        }

        // --- Store points ---
        let storesForSource = initialStoresRef.current ?? [];

        if (!storesForSource.length) {
          try {
            const storesRes = await fetch(buildApiUrl("/zones"));
            if (storesRes.ok) {
              const raw: ZoneApiStore[] = await storesRes.json();
              const collected: StoreData[] = [];
              for (const item of raw) {
                const departmentCode = String(
                  item.Zone_Code ?? item.Zone_Name ?? ""
                ).trim();
                if (!departmentCode) {
                  continue;
                }

                const store: StoreData = {
                  Area_Code: item.Area_Code ?? "",
                  Area_Name: item.Area_Name ?? "Unknown area",
                  Department_Code: departmentCode,
                  Department_Name: item.Zone_Name,
                  SQM: item.SQM,
                  Longitude: item.Longitude,
                  Latitude: item.Latitude,
                  Adresse: item.Adresse,
                  Format: item.Format,
                  City_Name: item.City_Name ?? undefined,
                  Zone_Code: item.Zone_Code ?? undefined,
                  Zone_Name: item.Zone_Name ?? undefined,
                  SubZone_Name: item.SubZone_Name ?? null,
                  SubZone_GeoJSON: item.SubZone_GeoJSON ?? null,
                };

                collected.push(store);
              }
              storesForSource = collected;
            } else {
              console.warn("Failed to load stores from API");
            }
          } catch (storeErr) {
            console.error("Failed to load store data:", storeErr);
          }
        }

        if (isMounted) {
          setStoresData(storesForSource);
        }

        map.addSource("stores", {
          type: "geojson",
          data: buildStoreFeatureCollection(storesForSource),
          cluster: false,
        });

        map.addSource("subzones", {
          type: "geojson",
          data: buildSubzoneFeatureCollection(storesForSource),
        });

        map.addLayer({
          id: "subzone-highlight",
          type: "line",
          source: "subzones",
          layout: {
            visibility: "none",
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#f97316",
            "line-width": 4,
            "line-opacity": 0.85,
            "line-dasharray": [2, 1.5],
            "line-blur": 0.5,
          },
          filter: ["==", "zoneNormalized", "__none__"],
        });

        // Individual store points
        map.addLayer({
          id: "store-points",
          type: "circle",
          source: "stores",
          filter: ["!has", "point_count"],
          paint: {
            "circle-radius": 6,
            "circle-color": "#ef4444",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.8,
          },
        });

        map.addLayer({
          id: "store-points-highlight",
          type: "circle",
          source: "stores",
          filter: createEmptyStoreHighlightFilter(),
          paint: {
            "circle-radius": 9,
            "circle-color": "#f97316",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.9,
          },
        });

        // Store labels (toggle with zoom)
        map.addLayer({
          id: "store-labels",
          type: "symbol",
          source: "stores",
          filter: createEmptyStoreHighlightFilter(),
          layout: {
            "text-field": ["get", "department"],
            "text-size": 12,
            "text-offset": [0, 1.2],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            visibility: "none",
          },
          paint: {
            "text-color": "#111827",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });

        const handleZoomChange = () => {
          const zoomLevel = map.getZoom();
          const showAllStoreLabels = zoomLevel >= STORE_LABEL_VISIBILITY_ZOOM;
          const { highlightFilter, displayFilter } =
            getStoreSelectionFilterContext(
              selectionRef.current,
              storeFocusRef.current
            );
          const storeLabelFilter = showAllStoreLabels
            ? displayFilter
            : highlightFilter;

          if (map.getLayer("store-labels")) {
            map.setFilter("store-labels", storeLabelFilter);
            map.setLayoutProperty(
              "store-labels",
              "visibility",
              showAllStoreLabels ? "visible" : "none"
            );
          }

          if (map.getLayer("business-labels")) {
            const showBusinessLabels =
              zoomLevel >= COMPETITION_LABEL_VISIBILITY_ZOOM;
            map.setLayoutProperty(
              "business-labels",
              "visibility",
              showBusinessLabels ? "visible" : "none"
            );
          }
        };

        map.on("zoom", handleZoomChange);

        const focusStore = (
          props: StoreFeatureProperties,
          lng: number,
          lat: number
        ) => {
          updateStoreFocus({
            department: props.department,
            coordinates: [lng, lat],
          });

          const currentZoom = map.getZoom();
          const targetZoom = Math.max(currentZoom, 13.5);

          map.easeTo({
            center: [lng, lat],
            zoom: targetZoom,
            duration: 900,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
        };

        // Popups for stores
        map.on("click", "store-points", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0]
            .properties as unknown as StoreFeatureProperties;
          const formatLine = props.format
            ? `<div style="margin-top:4px;color:#f97316;font-weight:600">${props.format}</div>`
            : "";
          const addressLine = props.address
            ? `<div style="margin-top:4px;color:#6b7280">${props.address}</div>`
            : "";
          const sqmLine = Number.isFinite(props.sqm)
            ? `<div style="margin-top:4px;color:#0f172a;font-weight:500">${props.sqm.toLocaleString()} m²</div>`
            : "";
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:Inter,system-ui,sans-serif;min-width:180px">
                    <strong style="font-size:14px;color:#111827">${props.department}</strong>
                    <div style="margin-top:2px;color:#1f2937;font-size:12px">${props.city}</div>
                    ${formatLine}
                    ${addressLine}
                    ${sqmLine}
                  </div>`
            )
            .addTo(map);

          focusStore(props, e.lngLat.lng, e.lngLat.lat);
        });

        map.on("click", "store-points-highlight", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0]
            .properties as unknown as StoreFeatureProperties;
          const formatLine = props.format
            ? `<div style="margin-top:4px;color:#f97316;font-weight:600">${props.format}</div>`
            : "";
          const addressLine = props.address
            ? `<div style="margin-top:4px;color:#6b7280">${props.address}</div>`
            : "";
          const sqmLine = Number.isFinite(props.sqm)
            ? `<div style="margin-top:4px;color:#0f172a;font-weight:500">${props.sqm.toLocaleString()} m²</div>`
            : "";
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:Inter,system-ui,sans-serif;min-width:180px">
                    <strong style="font-size:14px;color:#111827">${props.department}</strong>
                    <div style="margin-top:2px;color:#1f2937;font-size:12px">${props.city}</div>
                    ${formatLine}
                    ${addressLine}
                    ${sqmLine}
                  </div>`
            )
            .addTo(map);

          focusStore(props, e.lngLat.lng, e.lngLat.lat);
        });

        map.on("mouseenter", "store-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "store-points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "store-points-highlight", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "store-points-highlight", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", (event) => {
          const nearbyStoreFeatures = map.queryRenderedFeatures(event.point, {
            layers: [
              "store-points",
              "store-points-highlight",
              "business-points",
            ],
          });

          if (nearbyStoreFeatures.length === 0) {
            updateStoreFocus(null);
          }
        });

        map.addSource("businesses", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "business-points",
          type: "circle",
          source: "businesses",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 12, 7],
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              0,
              8.5,
              0.35,
              11,
              0.75,
              13,
              0.95,
            ],
          },
        });

        map.addLayer({
          id: "business-labels",
          type: "symbol",
          source: "businesses",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, 1.1],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            visibility: "none",
          },
          paint: {
            "text-color": "#065f46",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });

        map.on("mouseenter", "business-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "business-points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "business-points", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as BusinessProperties;
          const addressLine = props.address ? `<br/>${props.address}` : "";
          const storeLine = props.storeDepartment
            ? `<br/><small>Near: ${props.storeDepartment}</small>`
            : "";

          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>${props.name}</strong><br/>${props.categoryLabel}${addressLine}${storeLine}`
            )
            .addTo(map);
        });

        try {
          const businessesRes = await fetch(
            buildApiUrl("/combined/stores-with-businesses")
          );

          if (businessesRes.ok) {
            const data: StoreWithBusinesses[] = await businessesRes.json();
            const features = data.flatMap((store) => {
              if (!store.NearbyBusinesses?.length) {
                return [];
              }

              return store.NearbyBusinesses.filter(
                (b) => b.Longitude && b.Latitude
              ).map((business) => {
                const normalizedCategoryRaw = (business.Category || "other")
                  .toLowerCase()
                  .trim();
                const normalizedCategory =
                  normalizedCategoryRaw.length > 0
                    ? normalizedCategoryRaw
                    : "other";

                return {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: [business.Longitude, business.Latitude],
                  },
                  properties: {
                    id: business.OSM_Id,
                    name: business.Name || "Unknown",
                    category: normalizedCategory,
                    categoryLabel: humanizeCategory(
                      normalizedCategory || "other"
                    ),
                    address: business.Address,
                    storeDepartment: store.Department_Name,
                    areaName: store.Area_Name,
                    cityName: store.City_Name,
                  },
                } satisfies GeoJSON.Feature<GeoJSON.Point, BusinessProperties>;
              });
            });

            businessFeaturesRef.current = features;

            if (isMounted) {
              const categoryToUse = refreshBusinessCategoryState(
                selectionRef.current,
                storeFocusRef.current
              );
              updateBusinessSource(
                map,
                categoryToUse ?? selectedCategoryRef.current
              );
            }
          }
        } catch (err) {
          console.error("Failed to load business data:", err);
        }

        // Hover highlight for cities
        let hoveredCity: string | null = null;
        map.on("mousemove", "city-boundaries", (e) => {
          if (!e.features?.length) return;
          const cityName = e.features[0].properties?.[nameKey];
          if (cityName && cityName !== hoveredCity) {
            hoveredCity = cityName;
            map.setFilter("city-hover", ["==", ["get", nameKey], cityName]);
          }
        });
        map.on("mouseleave", "city-boundaries", () => {
          hoveredCity = null;
          map.setFilter("city-hover", ["==", ["get", nameKey], ""]);
        });

        // FlyTo on city click
        map.on("click", "city-boundaries", (e) => {
          if (!e.features?.length) return;
          const cityName = e.features[0].properties?.[nameKey];
          if (cityName) {
            map.flyTo({
              center: e.lngLat,
              zoom: 10,
              bearing: -20,
              pitch: 45,
              duration: 2000,
            });
          }
        });
      } catch (err) {
        console.error("Map load error:", err);
      }
      applySelectionToMap();
    });

    return () => {
      isMounted = false;
      map.remove();
    };
  }, [
    navigate,
    cities,
    darkMode,
    updateBusinessSource,
    applySelectionToMap,
    updateStoreFocus,
    refreshBusinessCategoryState,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!map.isStyleLoaded()) {
      map.once("load", () => updateBusinessSource(map, selectedCategory));
      return;
    }

    updateBusinessSource(map, selectedCategory);
  }, [selectedCategory, updateBusinessSource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!map.getLayer(POPULATION_FILL_LAYER_ID)) {
      return;
    }

    const visibility = populationOverlayEnabled ? "visible" : "none";
    map.setLayoutProperty(POPULATION_FILL_LAYER_ID, "visibility", visibility);
    map.setPaintProperty(
      POPULATION_FILL_LAYER_ID,
      "fill-opacity",
      populationOverlayEnabled ? populationOverlayOpacity : 0
    );

    if (map.getLayer(POPULATION_OUTLINE_LAYER_ID)) {
      map.setLayoutProperty(
        POPULATION_OUTLINE_LAYER_ID,
        "visibility",
        visibility
      );
    }
  }, [populationOverlayEnabled, populationOverlayOpacity]);

  const selectionCompetition = useMemo(() => {
    if (!selection) {
      return null;
    }

    const relevantBusinesses = filterBusinessFeaturesBySelection(
      businessFeaturesRef.current,
      selection,
      focusedStore
    );

    const counts = new Map<string, number>();
    for (const feature of relevantBusinesses) {
      const categoryKey = feature.properties?.category ?? "other";
      counts.set(categoryKey, (counts.get(categoryKey) ?? 0) + 1);
    }

    const topCategories = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({
        category,
        count,
        label: humanizeCategory(category),
      }));

    return {
      total: relevantBusinesses.length,
      topCategories,
    };
  }, [selection, focusedStore, filterBusinessFeaturesBySelection]);

  const visibleCompetitionCount = useMemo(() => {
    const relevantBusinesses = filterBusinessFeaturesBySelection(
      businessFeaturesRef.current,
      selection,
      focusedStore
    );

    if (!selection && !focusedStore) {
      return 0;
    }

    if (selectedCategory === DEFAULT_COMPETITION_CATEGORY) {
      return relevantBusinesses.length;
    }

    return relevantBusinesses.filter(
      (feature) => feature.properties?.category === selectedCategory
    ).length;
  }, [
    selection,
    focusedStore,
    selectedCategory,
    filterBusinessFeaturesBySelection,
  ]);

  const selectionSummary = useMemo(() => {
    if (!selection) {
      return null;
    }

    let matchingStores: StoreData[] = [];
    let label = "";
    let focusLabel = "City focus";
    let cityNames: string[] = [];
    let areaNames: string[] = [];

    if (selection.mode === "city") {
      label = selection.city;
      focusLabel = "City focus";
      cityNames = [selection.city];
      const normalizedTarget = normalizeName(selection.city);
      matchingStores = storesData.filter((store) => {
        const candidateName = normalizeName(
          store.City_Name ?? store.Area_Name.replace(/ Area$/i, "")
        );
        return candidateName === normalizedTarget;
      });
    } else if (selection.mode === "area") {
      label = selection.area;
      focusLabel = "Area focus";
      cityNames = selection.cities;
      areaNames = [selection.area];
      const normalizedTarget = normalizeName(selection.area);
      matchingStores = storesData.filter((store) => {
        const areaName = store.Area_Name ? normalizeName(store.Area_Name) : "";
        return areaName === normalizedTarget;
      });
    } else {
      label = selection.zone;
      focusLabel = "Zone focus";
      cityNames = selection.cities;
      areaNames = selection.areas;
      const normalizedTarget = normalizeName(selection.zone);
      matchingStores = storesData.filter((store) => {
        const zoneName = normalizeName(store.Zone_Name ?? "Unassigned Zone");
        return zoneName === normalizedTarget;
      });
    }

    const totalSQM = matchingStores.reduce(
      (sum, store) => sum + (store.SQM ?? 0),
      0
    );
    const formats = new Map<string, number>();
    for (const store of matchingStores) {
      const key = (store.Format ?? "Unspecified").trim() || "Unspecified";
      formats.set(key, (formats.get(key) ?? 0) + 1);
    }

    const geocodedCount = matchingStores.filter(
      (store) => store.Latitude !== null && store.Longitude !== null
    ).length;

    const topFormats = Array.from(formats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([format, count]) => ({ format, count }));

    return {
      mode: selection.mode,
      focusLabel,
      label,
      cities: cityNames,
      areas: areaNames,
      stores: matchingStores,
      storeCount: matchingStores.length,
      totalSQM,
      geocodedCount,
      topFormats,
    };
  }, [selection, storesData]);

  const displayedStores = selectionSummary?.stores.slice(0, 6) ?? [];
  const additionalStoreCount =
    selectionSummary && selectionSummary.storeCount > displayedStores.length
      ? selectionSummary.storeCount - displayedStores.length
      : 0;
  const geoCoveragePercent = selectionSummary
    ? selectionSummary.storeCount > 0
      ? Math.round(
          (selectionSummary.geocodedCount / selectionSummary.storeCount) * 100
        )
      : 0
    : 0;

  const selectionKpis = useMemo<SelectionKpiData | null>(() => {
    if (!selectionSummary) {
      return null;
    }

    const key = `${selectionSummary.label}-${selectionSummary.mode}`;
    const baseSeed =
      key.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
    const seeded = (offset: number, min: number, max: number) => {
      const x = Math.sin(baseSeed + offset) * 10000;
      const fraction = x - Math.floor(x);
      return fraction * (max - min) + min;
    };

    const focusThemes = [
      "Fresh market leadership",
      "Click & collect expansion",
      "Loyalty activation",
      "Convenience missions",
      "Local sourcing partnerships",
      "Urban micro-fulfilment",
    ];

    const focusIndex = Math.floor(seeded(1, 0, focusThemes.length));
    const primaryFocus = focusThemes[focusIndex % focusThemes.length];
    const secondaryFocus = focusThemes[(focusIndex + 2) % focusThemes.length];
    const opportunityScore = Math.round(seeded(2, 68, 96));
    const momentumIndex = Math.round(seeded(3, 54, 92));
    const yoyTrend = Number(seeded(4, -2.5, 8.5).toFixed(1));
    const avgBasket = Number(seeded(5, 14, 32).toFixed(1));
    const dwellTime = Math.round(seeded(6, 12, 28));
    const householdReach = Math.round(seeded(7, 28, 62));
    const weeklyVisits = Math.round(seeded(8, 12, 44));
    const newShopperGain = Math.round(seeded(9, 7, 21));
    const loyaltyShare = Math.round(seeded(10, 46, 82));
    const digitalOrders = Math.round(seeded(11, 9, 26));
    const promoUplift = Number(seeded(12, 2.5, 7.5).toFixed(1));
    const staffedHours = Math.round(seeded(13, 420, 620));
    const onShelfAvailability = Math.round(seeded(14, 86, 97));
    const wasteRate = Number(seeded(15, 1.4, 3.8).toFixed(1));
    const energyIntensity = Math.round(seeded(16, 520, 690));

    const toMetric = (
      label: string,
      value: string,
      helper: string
    ): SelectionKpiMetric => ({ label, value, helper });

    return {
      summary: {
        opportunityScore,
        momentumIndex,
        yoyTrend,
        primaryFocus,
        secondaryFocus,
      },
      dwellTime,
      avgBasket,
      network: [
        toMetric(
          "Weekly visits",
          `${weeklyVisits}k`,
          "Estimated in-store footfall"
        ),
        toMetric(
          "Household reach",
          `${householdReach}%`,
          "Population within a 10 km radius"
        ),
        toMetric(
          "New shopper gain",
          `${newShopperGain}%`,
          "Quarter-over-quarter increase"
        ),
      ],
      shopper: [
        toMetric(
          "Loyalty share",
          `${loyaltyShare}%`,
          "Transactions with Viva Club ID"
        ),
        toMetric(
          "Digital orders",
          `${digitalOrders}%`,
          "Click & collect contribution"
        ),
        toMetric(
          "Promo uplift",
          `${promoUplift}%`,
          "Incremental uplift from campaigns"
        ),
      ],
      operations: [
        toMetric("Avg. basket", `€${avgBasket.toFixed(1)}`, "Tax inclusive"),
        toMetric(
          "Staffed hours",
          `${staffedHours}`,
          "Weekly total across locations"
        ),
        toMetric(
          "On-shelf availability",
          `${onShelfAvailability}%`,
          "Last 4-week audit"
        ),
      ],
      sustainability: [
        toMetric(
          "Food waste rate",
          `${wasteRate}%`,
          "Against 2% internal target"
        ),
        toMetric(
          "Energy intensity",
          `${energyIntensity.toLocaleString()} kWh`,
          "Per 1k m² trading area"
        ),
      ],
    };
  }, [selectionSummary]);

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    categorySelectionWasUserDriven.current = true;
    setSelectedCategory(event.target.value);
  };

  const handlePopulationOverlayToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setPopulationOverlayEnabled(checked);
  };

  const handlePopulationOpacityChange = (
    _event: Event,
    value: number | number[]
  ) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setPopulationOverlayOpacity(Math.max(0, Math.min(1, numericValue / 100)));
  };

  useEffect(() => {
    populationOverlayEnabledRef.current = populationOverlayEnabled;
  }, [populationOverlayEnabled]);

  useEffect(() => {
    populationOverlayOpacityRef.current = populationOverlayOpacity;
  }, [populationOverlayOpacity]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <Box
        sx={{
          position: "absolute",
          top: { xs: 60, sm: 80 },
          left: 16,
          right: 16,
          zIndex: 3,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 2,
          pointerEvents: "none",
        }}
      >
        <Stack
          spacing={2}
          sx={{
            pointerEvents: "auto",
            flex: { xs: "1 1 100%", sm: "0 0 auto" },
            width: { xs: "100%", sm: 260 },
            maxWidth: { xs: "100%", sm: 280 },
          }}
        >
          <Paper
            elevation={8}
            sx={{
              px: 2,
              py: 1.75,
              borderRadius: 3,
              backgroundColor: "rgba(15, 23, 42, 0.86)",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              color: "rgba(226, 232, 240, 0.95)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Bolt sx={{ fontSize: 18, color: "primary.light" }} />
              <Typography
                variant="overline"
                sx={{ letterSpacing: 0.7, color: "rgba(148, 163, 184, 0.8)" }}
              >
                Population density
              </Typography>
            </Stack>
            {populationOverlayLoading ? (
              <Box sx={{ mt: 2 }}>
                <LinearProgress color="primary" />
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 1,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  Loading Kontur population grid…
                </Typography>
              </Box>
            ) : (
              <>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mt: 1.5 }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226, 232, 240, 0.85)" }}
                  >
                    Overlay visibility
                  </Typography>
                  <Switch
                    size="small"
                    checked={populationOverlayEnabled}
                    onChange={handlePopulationOverlayToggle}
                    disabled={!populationOverlayAvailable}
                  />
                </Stack>
                {populationOverlayError ? (
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 1,
                      display: "block",
                      color: "rgba(248, 113, 113, 0.9)",
                    }}
                  >
                    {populationOverlayError}
                  </Typography>
                ) : (
                  <>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1,
                        display: "block",
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      {populationOverlayStats
                        ? `${populationOverlayStats.cellCount.toLocaleString()} grid cells · ${Math.round(
                            populationOverlayStats.totalPopulation
                          ).toLocaleString()} people total`
                        : "Toggle to reveal Kontur population intensity."}
                    </Typography>
                    <Box
                      sx={{
                        mt: 1.5,
                        height: 12,
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, rgba(254, 243, 199, 1) 0%, rgba(253, 230, 138, 1) 25%, rgba(251, 191, 36, 1) 50%, rgba(249, 115, 22, 1) 75%, rgba(194, 65, 12, 1) 100%)",
                        border: "1px solid rgba(148, 163, 184, 0.4)",
                      }}
                    />
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ mt: 0.5 }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(148, 163, 184, 0.7)" }}
                      >
                        Lower
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(148, 163, 184, 0.7)" }}
                      >
                        Higher
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1.5,
                        display: "block",
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Opacity
                    </Typography>
                    <Slider
                      size="small"
                      value={Math.round(populationOverlayOpacity * 100)}
                      onChange={handlePopulationOpacityChange}
                      step={5}
                      min={20}
                      max={100}
                      disabled={!populationOverlayEnabled}
                      sx={{
                        mt: 0.5,
                        color: "#f97316",
                        "& .MuiSlider-thumb": {
                          boxShadow: "0 0 0 4px rgba(249, 115, 22, 0.25)",
                        },
                      }}
                    />
                  </>
                )}
              </>
            )}
          </Paper>
          {businessCategories.length > 0 && (
            <Paper
              elevation={8}
              sx={{
                px: 2,
                py: 1.75,
                borderRadius: 3,
                backgroundColor: "rgba(15, 23, 42, 0.86)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                color: "rgba(226, 232, 240, 0.95)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tune sx={{ fontSize: 18, color: "primary.light" }} />
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 0.7,
                      color: "rgba(148, 163, 184, 0.8)",
                    }}
                  >
                    Competition filter
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(148, 163, 184, 0.8)" }}
                >
                  {visibleCompetitionCount.toLocaleString()} shown
                </Typography>
              </Stack>
              <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                <InputLabel id="business-category-label">Category</InputLabel>
                <Select
                  labelId="business-category-label"
                  id="business-category"
                  value={selectedCategory}
                  label="Category"
                  onChange={handleCategoryChange}
                >
                  <MenuItem value={DEFAULT_COMPETITION_CATEGORY}>
                    All categories
                  </MenuItem>
                  {businessCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {humanizeCategory(category)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography
                variant="caption"
                sx={{
                  mt: 1.5,
                  display: "block",
                  color: "rgba(226, 232, 240, 0.75)",
                }}
              >
                {selectedCategory === DEFAULT_COMPETITION_CATEGORY
                  ? "Showing all nearby businesses for this focus."
                  : `Focusing on ${humanizeCategory(selectedCategory)} venues.`}
              </Typography>
              {visibleCompetitionCount === 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.75,
                    display: "block",
                    color: "rgba(148, 163, 184, 0.7)",
                  }}
                >
                  No mapped businesses for this filter yet.
                </Typography>
              )}
            </Paper>
          )}
        </Stack>

        {selectionSummary && (
          <Paper
            elevation={10}
            sx={{
              pointerEvents: "auto",
              ml: { sm: "auto" },
              flex: { xs: "1 1 100%", sm: "0 0 auto" },
              width: { xs: "100%", sm: 320, md: 360 },
              maxWidth: { xs: "100%", sm: 360 },
              maxHeight: {
                xs: "calc(100vh - 200px)",
                md: "calc(100vh - 180px)",
              },
              display: "flex",
              flexDirection: "column",
              borderRadius: 3,
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              color: "rgba(226, 232, 240, 0.95)",
              backdropFilter: "blur(10px)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 2.5, pb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationCity sx={{ fontSize: 20, color: "primary.light" }} />
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 0.8,
                    color: "rgba(148, 163, 184, 0.85)",
                  }}
                >
                  {selectionSummary.focusLabel}
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                {selectionSummary.label}
              </Typography>
              {selectionSummary.mode === "city" && (
                <Button
                  size="small"
                  variant="outlined"
                  color="info"
                  startIcon={<TravelExplore fontSize="small" />}
                  sx={{
                    mt: 1.5,
                    borderRadius: 9999,
                    alignSelf: "flex-start",
                  }}
                  onClick={() =>
                    navigate(
                      `/report/${encodeURIComponent(selectionSummary.label)}`
                    )
                  }
                >
                  Open layered report
                </Button>
              )}
              {selectionKpis && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2.5,
                    backgroundImage:
                      "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(236,72,153,0.08))",
                    border: "1px solid rgba(96, 165, 250, 0.35)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems="stretch"
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ flex: 1 }}
                    >
                      <Avatar
                        variant="rounded"
                        sx={{
                          bgcolor: "rgba(59, 130, 246, 0.22)",
                          border: "1px solid rgba(96, 165, 250, 0.4)",
                          color: "rgba(191, 219, 254, 0.95)",
                        }}
                      >
                        <Bolt fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: 0.8,
                            color: "rgba(191, 219, 254, 0.75)",
                            textTransform: "uppercase",
                          }}
                        >
                          Opportunity score
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>
                          {selectionKpis.summary.opportunityScore}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={selectionKpis.summary.opportunityScore}
                          sx={{ mt: 1, height: 6, borderRadius: 999 }}
                        />
                      </Box>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ flex: 1 }}
                    >
                      <Avatar
                        variant="rounded"
                        sx={{
                          bgcolor: "rgba(16, 185, 129, 0.22)",
                          border: "1px solid rgba(52, 211, 153, 0.4)",
                          color: "rgba(167, 243, 208, 0.95)",
                        }}
                      >
                        <TrendingUp fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: 0.8,
                            color: "rgba(167, 243, 208, 0.8)",
                            textTransform: "uppercase",
                          }}
                        >
                          Momentum index
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          {selectionKpis.summary.momentumIndex}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color:
                              selectionKpis.summary.yoyTrend >= 0
                                ? "rgba(134, 239, 172, 0.95)"
                                : "rgba(248, 113, 113, 0.92)",
                            fontWeight: 500,
                          }}
                        >
                          {`${selectionKpis.summary.yoyTrend >= 0 ? "+" : ""}${
                            selectionKpis.summary.yoyTrend
                          }% YoY`}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mt: 2, color: "rgba(226, 232, 240, 0.85)" }}
                  >
                    {`Focus on ${selectionKpis.summary.primaryFocus} while building momentum in ${selectionKpis.summary.secondaryFocus}.`}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1.5, flexWrap: "wrap" }}
                  >
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={selectionKpis.summary.primaryFocus}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Support: ${selectionKpis.summary.secondaryFocus}`}
                      sx={{ borderColor: "rgba(96, 165, 250, 0.4)" }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<AccessTime fontSize="small" />}
                      label={`Dwell ${selectionKpis.dwellTime} min`}
                    />
                    <Chip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      icon={<ShoppingBag fontSize="small" />}
                      label={`Avg basket €${selectionKpis.avgBasket.toFixed(
                        1
                      )}`}
                    />
                  </Stack>
                </Box>
              )}
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, flexWrap: "wrap" }}
              >
                {selectionSummary.cities.map((city) => (
                  <Chip
                    key={city}
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={city}
                  />
                ))}
              </Stack>
              {selectionSummary.mode === "zone" &&
                selectionSummary.areas.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography
                      variant="overline"
                      sx={{
                        letterSpacing: 0.7,
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Areas
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: "wrap", mt: 0.5 }}
                    >
                      {selectionSummary.areas.map((area) => (
                        <Chip
                          key={area}
                          size="small"
                          variant="outlined"
                          label={area}
                          sx={{
                            borderColor: "rgba(148, 163, 184, 0.4)",
                            color: "rgba(226, 232, 240, 0.9)",
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
            </Box>
            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.2)" }} />
            <Box sx={{ p: 2, pt: 1.5 }}>
              <Stack direction="row" spacing={1.25} sx={{ flexWrap: "wrap" }}>
                {[
                  {
                    label: "Stores",
                    value: selectionSummary.storeCount.toLocaleString(),
                  },
                  {
                    label: "Total SQM",
                    value: `${selectionSummary.totalSQM.toLocaleString()} m²`,
                  },
                  {
                    label: "Geo coverage",
                    value: `${geoCoveragePercent}%`,
                    helper: `${selectionSummary.geocodedCount.toLocaleString()} geocoded`,
                  },
                ].map(({ label, value, helper }) => (
                  <Box
                    key={label}
                    sx={{
                      flex: "1 1 120px",
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 2,
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      bgcolor: "rgba(30, 41, 59, 0.55)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(191, 219, 254, 0.7)",
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {value}
                    </Typography>
                    {helper && (
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                      >
                        {helper}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
              {selectionKpis && (
                <>
                  <Divider
                    sx={{
                      mt: 2,
                      mb: 1.5,
                      borderColor: "rgba(148, 163, 184, 0.18)",
                    }}
                  />
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{
                        letterSpacing: 0.7,
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Network KPIs
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {selectionKpis.network.map((metric) => (
                        <Box
                          key={metric.label}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            border: "1px solid rgba(148, 163, 184, 0.22)",
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {metric.label}
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "rgba(191, 219, 254, 0.95)",
                            }}
                          >
                            {metric.value}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                          >
                            {metric.helper}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ mt: 2.5 }}>
                    <Typography
                      variant="overline"
                      sx={{
                        letterSpacing: 0.7,
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Shopper KPIs
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {selectionKpis.shopper.map((metric) => (
                        <Box
                          key={metric.label}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            border: "1px solid rgba(148, 163, 184, 0.22)",
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {metric.label}
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "rgba(191, 219, 254, 0.95)",
                            }}
                          >
                            {metric.value}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                          >
                            {metric.helper}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ mt: 2.5 }}>
                    <Typography
                      variant="overline"
                      sx={{
                        letterSpacing: 0.7,
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Operational KPIs
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {selectionKpis.operations.map((metric) => (
                        <Box
                          key={metric.label}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            border: "1px solid rgba(148, 163, 184, 0.22)",
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {metric.label}
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "rgba(191, 219, 254, 0.95)",
                            }}
                          >
                            {metric.value}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                          >
                            {metric.helper}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ mt: 2.5 }}>
                    <Typography
                      variant="overline"
                      sx={{
                        letterSpacing: 0.7,
                        color: "rgba(148, 163, 184, 0.75)",
                      }}
                    >
                      Sustainability pulse
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {selectionKpis.sustainability.map((metric) => (
                        <Box
                          key={metric.label}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            border: "1px solid rgba(148, 163, 184, 0.22)",
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {metric.label}
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: "rgba(191, 219, 254, 0.95)",
                            }}
                          >
                            {metric.value}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                          >
                            {metric.helper}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </>
              )}
              {selectionCompetition && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: "rgba(167, 243, 208, 0.95)" }}
                  >
                    Nearby competition
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226, 232, 240, 0.8)" }}
                  >
                    {selectionCompetition.total > 0
                      ? `${selectionCompetition.total.toLocaleString()} nearby location${
                          selectionCompetition.total === 1 ? "" : "s"
                        }`
                      : "No competition data yet"}
                  </Typography>
                  {selectionCompetition.topCategories.length > 0 && (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mt: 1, flexWrap: "wrap" }}
                    >
                      {selectionCompetition.topCategories.map(
                        ({ category, label, count }) => (
                          <Chip
                            key={category}
                            label={`${label} (${count})`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{
                              bgcolor: "rgba(16, 185, 129, 0.14)",
                              color: "rgba(167, 243, 208, 0.95)",
                              borderColor: "rgba(16, 185, 129, 0.35)",
                            }}
                          />
                        )
                      )}
                    </Stack>
                  )}
                </Box>
              )}
            </Box>
            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.2)" }} />
            <Box sx={{ px: 2, py: 2, overflowY: "auto", maxHeight: 240 }}>
              {displayedStores.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(203, 213, 225, 0.85)" }}
                >
                  No Viva Fresh locations for this selection yet.
                </Typography>
              ) : (
                displayedStores.map((store) => (
                  <Box
                    key={store.Department_Code}
                    sx={{
                      py: 1.5,
                      borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
                      "&:last-of-type": { borderBottom: "none" },
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {store.Department_Name}
                      </Typography>
                      <Chip
                        size="small"
                        label={store.Format ?? "Unspecified"}
                        color="warning"
                        variant="outlined"
                        sx={{ color: "rgba(250, 204, 21, 0.92)" }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(226, 232, 240, 0.75)", mt: 0.5 }}
                    >
                      {store.Adresse ?? "Address coming soon"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(148, 163, 184, 0.75)",
                        mt: 0.5,
                        display: "block",
                      }}
                    >
                      {(store.SQM ?? 0).toLocaleString()} m² • {store.Area_Name}
                      {store.Zone_Name ? ` • ${store.Zone_Name}` : ""}
                    </Typography>
                  </Box>
                ))
              )}
              {additionalStoreCount > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(148, 163, 184, 0.8)",
                    display: "block",
                    mt: 1.5,
                  }}
                >
                  +{additionalStoreCount} additional location(s) in view.
                </Typography>
              )}
            </Box>
          </Paper>
        )}
      </Box>

      <Paper
        elevation={6}
        sx={{
          position: "absolute",
          left: 16,
          bottom: 24,
          zIndex: 3,
          width: 240,
          px: 2,
          py: 1.75,
          borderRadius: 3,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          border: "1px solid rgba(148, 163, 184, 0.28)",
          color: "rgba(226, 232, 240, 0.9)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <MapOutlined sx={{ fontSize: 18, color: "primary.light" }} />
          <Typography variant="overline" sx={{ letterSpacing: 0.7 }}>
            Map legend
          </Typography>
        </Stack>
        <Stack spacing={1.25} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                bgcolor: "#ef4444",
                border: "2px solid rgba(248, 250, 252, 0.7)",
                opacity: 0.85,
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: "rgba(226, 232, 240, 0.85)" }}
            >
              Viva Fresh stores
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: "#f97316",
                border: "2px solid rgba(255, 255, 255, 0.8)",
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: "rgba(226, 232, 240, 0.85)" }}
            >
              Focused stores
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                bgcolor: "#10b981",
                border: "2px solid rgba(248, 250, 252, 0.7)",
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: "rgba(226, 232, 240, 0.85)" }}
            >
              Nearby competition
            </Typography>
          </Stack>
          {populationOverlayEnabled && (
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              <Box
                sx={{
                  height: 12,
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, rgba(254, 243, 199, 1) 0%, rgba(253, 230, 138, 1) 25%, rgba(251, 191, 36, 1) 50%, rgba(249, 115, 22, 1) 75%, rgba(194, 65, 12, 1) 100%)",
                  border: "1px solid rgba(148, 163, 184, 0.4)",
                }}
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(226, 232, 240, 0.85)" }}
              >
                Population density (Kontur grid)
              </Typography>
            </Stack>
          )}
        </Stack>
        <Typography
          variant="caption"
          sx={{ mt: 1, color: "rgba(148, 163, 184, 0.65)" }}
        >
          Zoom in to reveal detailed labels.
        </Typography>
      </Paper>

      <Box
        ref={mapContainer}
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: 2,
          overflow: "hidden",
        }}
      />
    </Box>
  );
}
