
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl, {
  Map as MapLibreMap,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  area,
  booleanPointInPolygon,
  bbox,
  centroid,
  circle,
  distance,
  intersect,
  point,
} from "@turf/turf";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  FormControl,
  IconButton,
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
  ExpandLess,
  ExpandMore,
  LocationCity,
  MapOutlined,
  ShoppingBag,
  TravelExplore,
  TrendingUp,
  Tune,
} from "@mui/icons-material";
import {
  BakeryDining,
  Category,
  Checkroom,
  DevicesOther,
  LocalCafe,
  LocalFlorist,
  LocalGasStation,
  LocalGroceryStore,
  LocalMall,
  LocalPharmacy,
  Restaurant,
  Spa,
  SportsSoccer,
  Storefront,
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
  departmentCode: string;
  city: string;
  cityNormalized: string;
  area: string;
  areaNormalized: string;
  address: string | null;
  format: string | null;
  sqm: number | null;
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
  quadkey?: string;
  normalizedCellId?: string | number;
};

type StoreFocus = {
  department: string;
  departmentCode: string | null;
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

type PopulationHoverInfo = {
  population: number;
  density: number | null;
  areaKm2: number | null;
};

type StoreHoverDetails = {
  position: {
    left: number;
    top: number;
  };
  store: {
    name: string;
    code: string;
    sqm: number | null;
    city: string;
  };
  population: number | null;
  catchment: {
    population: number | null;
    radiusKm: number;
  };
  competition: {
    total: number;
    categories: {
      category: string;
      label: string;
      count: number;
    }[];
  };
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
const POPULATION_HOVER_LAYER_ID = "population-density-hover";
const POPULATION_CLUSTER_SOURCE_ID = "population-density-clusters";
const POPULATION_CLUSTER_LAYER_ID = "population-density-cluster";
const POPULATION_CLUSTER_COUNT_LAYER_ID = "population-density-cluster-count";
const POPULATION_CLUSTER_UNCLUSTERED_LAYER_ID =
  "population-density-single";
const POPULATION_DATA_URL = buildApiUrl("/population/grid");
const POPULATION_POLYGON_MIN_ZOOM = 10;
const POPULATION_CLUSTER_MAX_ZOOM = POPULATION_POLYGON_MIN_ZOOM - 1;
const CATCHMENT_BUFFER_STEPS = 64;
const STORE_CATCHMENT_SOURCE_ID = "store-catchment";
const STORE_CATCHMENT_FILL_LAYER_ID = "store-catchment-fill";
const STORE_CATCHMENT_OUTLINE_LAYER_ID = "store-catchment-outline";

const WEB_MERCATOR_RADIUS = 6378137;
const RAD_TO_DEG = 180 / Math.PI;

const isLikelyLonLatCoordinate = ([lng, lat]: [number, number]) =>
  Math.abs(lng) <= 180 && Math.abs(lat) <= 90;

const webMercatorToLonLat = (x: number, y: number): [number, number] => {
  const lng = (x / WEB_MERCATOR_RADIUS) * RAD_TO_DEG;
  const lat = Math.atan(Math.sinh(y / WEB_MERCATOR_RADIUS)) * RAD_TO_DEG;
  return [lng, lat];
};

const getCompetitionCategoryIcon = (category: string) => {
  const normalized = category.toLowerCase();

  if (
    normalized.includes("grocery") ||
    normalized.includes("market") ||
    normalized.includes("super")
  ) {
    return <LocalGroceryStore fontSize="small" sx={{ color: "#facc15" }} />;
  }

  if (
    normalized.includes("cafe") ||
    normalized.includes("coffee") ||
    normalized.includes("tea")
  ) {
    return <LocalCafe fontSize="small" sx={{ color: "#f97316" }} />;
  }

  if (normalized.includes("restaurant") || normalized.includes("food")) {
    return <Restaurant fontSize="small" sx={{ color: "#ef4444" }} />;
  }

  if (
    normalized.includes("pharm") ||
    normalized.includes("health") ||
    normalized.includes("medical")
  ) {
    return <LocalPharmacy fontSize="small" sx={{ color: "#22c55e" }} />;
  }

  if (normalized.includes("fashion") || normalized.includes("cloth")) {
    return <Checkroom fontSize="small" sx={{ color: "#38bdf8" }} />;
  }

  if (normalized.includes("beauty") || normalized.includes("spa")) {
    return <Spa fontSize="small" sx={{ color: "#ec4899" }} />;
  }

  if (normalized.includes("flower")) {
    return <LocalFlorist fontSize="small" sx={{ color: "#f472b6" }} />;
  }

  if (normalized.includes("gas") || normalized.includes("fuel")) {
    return <LocalGasStation fontSize="small" sx={{ color: "#fb923c" }} />;
  }

  if (normalized.includes("sport")) {
    return <SportsSoccer fontSize="small" sx={{ color: "#0ea5e9" }} />;
  }

  if (normalized.includes("tech") || normalized.includes("elect")) {
    return <DevicesOther fontSize="small" sx={{ color: "#8b5cf6" }} />;
  }

  if (normalized.includes("mall") || normalized.includes("retail")) {
    return <LocalMall fontSize="small" sx={{ color: "#f97316" }} />;
  }

  if (normalized.includes("bakery") || normalized.includes("bread")) {
    return <BakeryDining fontSize="small" sx={{ color: "#facc15" }} />;
  }

  if (normalized.includes("store")) {
    return <Storefront fontSize="small" sx={{ color: "#eab308" }} />;
  }

  return <Category fontSize="small" sx={{ color: "#cbd5f5" }} />;
};

const convertPopulationGeometryToLonLat = (
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): {
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  converted: boolean;
} => {
  const getSampleCoordinate = () => {
    if (geometry.type === "Polygon") {
      return geometry.coordinates[0]?.[0] as [number, number] | undefined;
    }
    return geometry.coordinates[0]?.[0]?.[0] as
      | [number, number]
      | undefined;
  };

  const sample = getSampleCoordinate();
  if (!sample || isLikelyLonLatCoordinate(sample)) {
    return { geometry, converted: false };
  }

  const convertRing = (ring: GeoJSON.Position[]) =>
    ring.map((coord) => {
      const [x, y] = coord as [number, number];
      return webMercatorToLonLat(x, y);
    });

  if (geometry.type === "Polygon") {
    return {
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) =>
          convertRing(ring as GeoJSON.Position[])
        ),
      },
      converted: true,
    };
  }

  return {
    geometry: {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => convertRing(ring as GeoJSON.Position[]))
      ),
    },
    converted: true,
  };
};

const normalizePopulationCollection = (
  collection: GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    PopulationFeatureProperties
  >
) => {
  let convertedAny = false;

  const features = collection.features.map((feature, index) => {
    if (!feature.geometry) {
      return feature;
    }

    const normalizedId =
      feature.id ??
      feature.properties?.id ??
      feature.properties?.quadkey ??
      index;

    const { geometry, converted } = convertPopulationGeometryToLonLat(
      feature.geometry
    );

    if (!converted) {
      return {
        ...feature,
        id: normalizedId,
        properties: {
          ...(feature.properties ?? {}),
          normalizedCellId: normalizedId,
        },
      };
    }

    convertedAny = true;
    return {
      ...feature,
      geometry,
      id: normalizedId,
      properties: {
        ...(feature.properties ?? {}),
        normalizedCellId: normalizedId,
      },
    };
  });

  if (!convertedAny) {
    return collection;
  }

  return {
    ...collection,
    features,
  };
};

type PopulationCellEntry = {
  feature: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    PopulationFeatureProperties
  >;
  area: number;
  centroid: [number, number];
  bbox: [number, number, number, number];
  population: number;
};

const buildPopulationCellEntries = (
  collection: GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    PopulationFeatureProperties
  >
): PopulationCellEntry[] => {
  const entries: PopulationCellEntry[] = [];

  for (const feature of collection.features) {
    if (!feature.geometry) {
      continue;
    }

    const preparedFeature = feature as GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      PopulationFeatureProperties
    >;

    const cellPopulation = Number(preparedFeature.properties?.population ?? 0);
    if (!Number.isFinite(cellPopulation) || cellPopulation <= 0) {
      continue;
    }

    const cellArea = area(preparedFeature);
    if (!Number.isFinite(cellArea) || cellArea <= 0) {
      continue;
    }

    const centroidFeature = centroid(preparedFeature);
    if (
      !centroidFeature.geometry ||
      centroidFeature.geometry.type !== "Point" ||
      !centroidFeature.geometry.coordinates
    ) {
      continue;
    }

    const cellBbox = bbox(preparedFeature);

    entries.push({
      feature: preparedFeature,
      area: cellArea,
      centroid: centroidFeature.geometry
        .coordinates as [number, number],
      bbox: cellBbox,
      population: cellPopulation,
    });
  }

  return entries;
};

const buildPopulationCentroidCollection = (
  entries: PopulationCellEntry[]
): GeoJSON.FeatureCollection<GeoJSON.Point, { population: number }> => ({
  type: "FeatureCollection",
  features: entries.map((entry) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: entry.centroid,
    },
    properties: { population: entry.population },
  })),
});


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
        departmentCode: store.Department_Code,
        city: fallbackCity,
        cityNormalized: normalizeName(fallbackCity),
        area: areaName,
        areaNormalized: normalizeName(areaName),
        address: store.Adresse ?? null,
        format: store.Format ?? null,
        sqm: store.SQM ?? null,
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
  const [populationHoverInfo, setPopulationHoverInfo] =
    useState<PopulationHoverInfo | null>(null);
  const populationHoverFeatureIdRef = useRef<string | number | null>(null);
  const populationFeatureCollectionRef = useRef<
    GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      PopulationFeatureProperties
    >
    | null
  >(null);
  const populationCellEntriesRef = useRef<PopulationCellEntry[]>([]);
  const [populationDataVersion, setPopulationDataVersion] = useState(0);
  const populationCentroidCollectionRef = useRef<
    GeoJSON.FeatureCollection<GeoJSON.Point, { population: number }> | null
  >(null);
  const storeCompetitionLookup = useRef<
    Map<string, BusinessProperties[]>
  >(new Map());
  const [storeHoverDetails, setStoreHoverDetails] = useState<
    StoreHoverDetails | null
  >(null);
  const [catchmentRadiusKm, setCatchmentRadiusKm] = useState(5);
  const catchmentRadiusRef = useRef(catchmentRadiusKm);
  const [storeCatchmentPopulations, setStoreCatchmentPopulations] = useState<
    Map<string, number>
  >(new Map());
  const storeCatchmentPopulationsRef = useRef<Map<string, number>>(new Map());
  const [selectionPanelExpanded, setSelectionPanelExpanded] = useState(false);
  const [populationPanelExpanded, setPopulationPanelExpanded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);

  const clearPopulationHover = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!map.getSource(POPULATION_SOURCE_ID)) {
      populationHoverFeatureIdRef.current = null;
      setPopulationHoverInfo(null);
      map.getCanvas().style.cursor = "";
      return;
    }

    if (populationHoverFeatureIdRef.current != null) {
      map.setFeatureState(
        {
          source: POPULATION_SOURCE_ID,
          id: populationHoverFeatureIdRef.current,
        },
        { hover: false }
      );
      populationHoverFeatureIdRef.current = null;
    }

    setPopulationHoverInfo(null);
    map.getCanvas().style.cursor = "";
  }, []);

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
        current.departmentCode === nextFocus.departmentCode &&
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
    setStoreHoverDetails(null);
  }, [selection]);

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

          const rawPopulationData =
            (await populationResponse.json()) as GeoJSON.FeatureCollection<
              GeoJSON.Polygon | GeoJSON.MultiPolygon,
              PopulationFeatureProperties
            >;

          const populationData = normalizePopulationCollection(
            rawPopulationData
          );

          populationFeatureCollectionRef.current = populationData;
          const populationEntries = buildPopulationCellEntries(populationData);
          populationCellEntriesRef.current = populationEntries;
          const centroidCollection = buildPopulationCentroidCollection(
            populationEntries
          );
          populationCentroidCollectionRef.current = centroidCollection;

          map.addSource(POPULATION_SOURCE_ID, {
            type: "geojson",
            data: populationData,
          });

          map.addSource(POPULATION_CLUSTER_SOURCE_ID, {
            type: "geojson",
            data: centroidCollection,
            cluster: true,
            clusterRadius: 60,
            clusterMaxZoom: POPULATION_CLUSTER_MAX_ZOOM,
            clusterProperties: {
              population: ["+", ["get", "population"]],
            },
          });

          const clusterColorExpression = [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "population"], 0],
            0,
            "rgba(30, 41, 59, 0.55)",
            500,
            "#fde68a",
            1500,
            "#fbbf24",
            3500,
            "#f97316",
            6000,
            "#c2410c",
          ] as unknown as ExpressionSpecification;

          map.addLayer({
            id: POPULATION_CLUSTER_LAYER_ID,
            type: "circle",
            source: POPULATION_CLUSTER_SOURCE_ID,
            filter: ["has", "point_count"],
            minzoom: 0,
            maxzoom: POPULATION_POLYGON_MIN_ZOOM,
            layout: {
              visibility: populationOverlayEnabledRef.current
                ? "visible"
                : "none",
            },
            paint: {
              "circle-color": clusterColorExpression,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "population"], 0],
                0,
                14,
                1000,
                20,
                2500,
                26,
                5000,
                32,
                8000,
                38,
              ],
              "circle-opacity": populationOverlayEnabledRef.current
                ? Math.min(0.9, populationOverlayOpacityRef.current + 0.2)
                : 0,
              "circle-stroke-color": "rgba(15, 23, 42, 0.45)",
              "circle-stroke-width": 1.5,
            },
          });

          map.addLayer(
            {
              id: POPULATION_CLUSTER_COUNT_LAYER_ID,
              type: "symbol",
              source: POPULATION_CLUSTER_SOURCE_ID,
              filter: ["has", "point_count"],
              minzoom: 0,
              maxzoom: POPULATION_POLYGON_MIN_ZOOM,
              layout: {
                visibility: populationOverlayEnabledRef.current
                  ? "visible"
                  : "none",
                "text-field": [
                  "case",
                  [">=", ["coalesce", ["get", "population"], 0], 1000],
                  [
                    "concat",
                    [
                      "to-string",
                      [
                        "round",
                        [
                          "/",
                          ["coalesce", ["get", "population"], 0],
                          1000,
                        ],
                      ],
                    ],
                    "k",
                  ],
                  [
                    "to-string",
                    ["round", ["coalesce", ["get", "population"], 0]],
                  ],
                ],
                "text-size": 12,
                "text-font": [
                  "Open Sans Bold",
                  "Arial Unicode MS Bold",
                ],
              },
              paint: {
                "text-color": "#0f172a",
                "text-halo-color": "#f8fafc",
                "text-halo-width": 1.4,
              },
            },
            POPULATION_CLUSTER_LAYER_ID
          );

          map.addLayer({
            id: POPULATION_CLUSTER_UNCLUSTERED_LAYER_ID,
            type: "circle",
            source: POPULATION_CLUSTER_SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            minzoom: 0,
            maxzoom: POPULATION_POLYGON_MIN_ZOOM,
            layout: {
              visibility: populationOverlayEnabledRef.current
                ? "visible"
                : "none",
            },
            paint: {
              "circle-color": clusterColorExpression,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "population"], 0],
                0,
                6,
                400,
                7.5,
                1200,
                9,
                2200,
                11,
                4000,
                13,
              ],
              "circle-opacity": populationOverlayEnabledRef.current
                ? Math.min(0.85, populationOverlayOpacityRef.current + 0.15)
                : 0,
              "circle-stroke-color": "rgba(15, 23, 42, 0.4)",
              "circle-stroke-width": 1,
            },
          });

          map.addLayer(
            {
              id: POPULATION_FILL_LAYER_ID,
              type: "fill",
              source: POPULATION_SOURCE_ID,
              minzoom: POPULATION_POLYGON_MIN_ZOOM,
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
                "fill-opacity-transition": {
                  duration: 200,
                },
              },
            },
            "city-boundaries"
          );

          map.addLayer(
            {
              id: POPULATION_HOVER_LAYER_ID,
              type: "fill",
              source: POPULATION_SOURCE_ID,
              minzoom: POPULATION_POLYGON_MIN_ZOOM,
              layout: {
                visibility: populationOverlayEnabledRef.current
                  ? "visible"
                  : "none",
              },
              paint: {
                "fill-color": "#f97316",
                "fill-opacity": [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  0.35,
                  0,
                ],
                "fill-outline-color": "rgba(249, 115, 22, 0.9)",
                "fill-opacity-transition": {
                  duration: 120,
                },
              },
            },
            POPULATION_OUTLINE_LAYER_ID
          );

          map.addLayer(
            {
              id: POPULATION_OUTLINE_LAYER_ID,
              type: "line",
              source: POPULATION_SOURCE_ID,
              minzoom: POPULATION_POLYGON_MIN_ZOOM,
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

          const handlePopulationMouseMove = (event: MapLayerMouseEvent) => {
            if (!populationOverlayEnabledRef.current) {
              clearPopulationHover();
              return;
            }

            const hoveredFeatures = (event.features as MapGeoJSONFeature[]) ??
              (map.queryRenderedFeatures(event.point, {
                layers: [POPULATION_FILL_LAYER_ID],
              }) as MapGeoJSONFeature[]);

            const targetFeature = hoveredFeatures?.[0];

            if (!targetFeature || targetFeature.id == null) {
              clearPopulationHover();
              return;
            }

            const featureId = targetFeature.id as string | number;

            if (populationHoverFeatureIdRef.current !== featureId) {
              if (populationHoverFeatureIdRef.current != null) {
                map.setFeatureState(
                  {
                    source: POPULATION_SOURCE_ID,
                    id: populationHoverFeatureIdRef.current,
                  },
                  { hover: false }
                );
              }

              populationHoverFeatureIdRef.current = featureId;
            }

            map.setFeatureState(
              {
                source: POPULATION_SOURCE_ID,
                id: featureId,
              },
              { hover: true }
            );

            const props = targetFeature.properties as
              | PopulationFeatureProperties
              | undefined;
            const rawPopulation = Number(props?.population ?? 0);

            let areaKm2: number | null = null;
            if (
              targetFeature.geometry.type === "Polygon" ||
              targetFeature.geometry.type === "MultiPolygon"
            ) {
              const areaSqMeters = area({
                type: "Feature",
                geometry: targetFeature.geometry,
                properties: {},
              } as GeoJSON.Feature<
                GeoJSON.Polygon | GeoJSON.MultiPolygon,
                PopulationFeatureProperties
              >);
              areaKm2 = Number.isFinite(areaSqMeters)
                ? areaSqMeters / 1_000_000
                : null;
            }

            const densityFromProps =
              props?.population_density != null
                ? Number(props.population_density)
                : null;

            const derivedDensity =
              densityFromProps != null && Number.isFinite(densityFromProps)
                ? densityFromProps
                : areaKm2 && areaKm2 > 0
                ? rawPopulation / areaKm2
                : null;

            setPopulationHoverInfo({
              population: rawPopulation,
              density:
                derivedDensity != null && Number.isFinite(derivedDensity)
                  ? derivedDensity
                  : null,
              areaKm2,
            });
          };

          const handlePopulationMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            clearPopulationHover();
          };

          map.on("mousemove", POPULATION_FILL_LAYER_ID, handlePopulationMouseMove);
          map.on("mouseleave", POPULATION_FILL_LAYER_ID, handlePopulationMouseLeave);
          map.on("mouseenter", POPULATION_FILL_LAYER_ID, () => {
            if (populationOverlayEnabledRef.current) {
              map.getCanvas().style.cursor = "crosshair";
            }
          });

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
            setPopulationDataVersion((previous) => previous + 1);
          }
        } catch (populationError) {
          console.error(
            "Failed to load population density overlay:",
            populationError
          );
          if (isMounted) {
            populationFeatureCollectionRef.current = null;
            populationCellEntriesRef.current = [];
            populationCentroidCollectionRef.current = null;
            setPopulationOverlayError(
              "Population density overlay could not be loaded."
            );
            setPopulationOverlayAvailable(false);
            setPopulationOverlayStats(null);
            clearPopulationHover();
            setPopulationDataVersion((previous) => previous + 1);
          }
        } finally {
          if (isMounted) {
            setPopulationOverlayLoading(false);
          }
        }

        map.addSource(STORE_CATCHMENT_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer(
          {
            id: STORE_CATCHMENT_FILL_LAYER_ID,
            type: "fill",
            source: STORE_CATCHMENT_SOURCE_ID,
            layout: { visibility: "none" },
            paint: {
              "fill-color": "rgba(59, 130, 246, 0.18)",
              "fill-opacity": 0.45,
            },
          },
          "city-boundaries"
        );

        map.addLayer(
          {
            id: STORE_CATCHMENT_OUTLINE_LAYER_ID,
            type: "line",
            source: STORE_CATCHMENT_SOURCE_ID,
            layout: { visibility: "none" },
            paint: {
              "line-color": "rgba(96, 165, 250, 0.9)",
              "line-width": 2,
              "line-dasharray": [2, 2.5],
            },
          },
          "city-boundaries"
        );

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

        const getPopulationAtPoint = (event: MapLayerMouseEvent) => {
          let populationValue: number | null = null;

          const renderedFeatures = map.queryRenderedFeatures(event.point, {
            layers: [POPULATION_FILL_LAYER_ID],
          }) as MapGeoJSONFeature[];

          const renderedFeature = renderedFeatures?.[0];

          if (renderedFeature?.properties) {
            const candidate = Number(
              (renderedFeature.properties as PopulationFeatureProperties)
                ?.population ?? null
            );
            if (Number.isFinite(candidate)) {
              populationValue = candidate;
            }
          }

          if (populationValue == null) {
            const collection = populationFeatureCollectionRef.current;
            if (collection) {
              const populationPoint = point([
                event.lngLat.lng,
                event.lngLat.lat,
              ]);

              for (const feature of collection.features) {
                if (!feature.geometry) {
                  continue;
                }

                if (
                  booleanPointInPolygon(
                    populationPoint,
                    feature as GeoJSON.Feature<
                      GeoJSON.Polygon | GeoJSON.MultiPolygon,
                      PopulationFeatureProperties
                    >
                  )
                ) {
                  const candidate = Number(feature.properties?.population);
                  if (Number.isFinite(candidate)) {
                    populationValue = candidate;
                  }
                  break;
                }
              }
            }
          }

          return populationValue;
        };

        const handleStoreHover = (event: MapLayerMouseEvent) => {
          if (!event.features?.length) {
            setStoreHoverDetails(null);
            return;
          }

          const props = event.features[0]
            .properties as unknown as StoreFeatureProperties;

          const competitionEntries =
            storeCompetitionLookup.current.get(props.department) ?? [];

          const categoryCounts = new Map<
            string,
            { label: string; count: number }
          >();

          for (const business of competitionEntries) {
            const key = business.category;
            const current = categoryCounts.get(key);
            if (current) {
              current.count += 1;
              continue;
            }
            categoryCounts.set(key, {
              label: business.categoryLabel || humanizeCategory(key),
              count: 1,
            });
          }

          const categories = Array.from(categoryCounts.entries())
            .map(([category, value]) => ({
              category,
              label: value.label,
              count: value.count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

          const populationValue = getPopulationAtPoint(event);
          const storeKey =
            props.departmentCode && props.departmentCode.trim().length > 0
              ? props.departmentCode
              : props.department;
          const catchmentPopulation =
            storeCatchmentPopulationsRef.current.get(storeKey) ?? null;
          const activeCatchmentRadius = catchmentRadiusRef.current;
          const containerRect = map.getContainer().getBoundingClientRect();
          const tooltipWidth = 260;
          const tooltipHeight = categories.length > 0 ? 190 : 150;
          const baseLeft = event.point.x + 18;
          const baseTop = event.point.y + 18;
          const maxLeft = Math.max(8, containerRect.width - tooltipWidth);
          const maxTop = Math.max(8, containerRect.height - tooltipHeight);

          const rawSqm = props.sqm != null ? Number(props.sqm) : null;
          const normalizedSqm =
            rawSqm != null && Number.isFinite(rawSqm) ? rawSqm : null;

          setStoreHoverDetails({
            position: {
              left: Math.max(8, Math.min(baseLeft, maxLeft)),
              top: Math.max(8, Math.min(baseTop, maxTop)),
            },
            store: {
              name: props.department,
              code: storeKey,
              sqm: normalizedSqm,
              city: props.city,
            },
            population: populationValue,
            catchment: {
              population: catchmentPopulation,
              radiusKm: activeCatchmentRadius,
            },
            competition: {
              total: competitionEntries.length,
              categories,
            },
          });
        };

        const clearStoreHover = () => {
          setStoreHoverDetails(null);
        };

        map.on("movestart", clearStoreHover);
        map.on("pitchstart", clearStoreHover);
        map.on("rotatestart", clearStoreHover);

        const focusStore = (
          props: StoreFeatureProperties,
          lng: number,
          lat: number
        ) => {
          updateStoreFocus({
            department: props.department,
            departmentCode:
              props.departmentCode && props.departmentCode.trim().length > 0
                ? props.departmentCode.trim()
                : null,
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
          const popupSqmValue =
            props.sqm != null && Number.isFinite(Number(props.sqm))
              ? Number(props.sqm)
              : null;
          const sqmLine = popupSqmValue != null
            ? `<div style="margin-top:4px;color:#0f172a;font-weight:500">${popupSqmValue.toLocaleString()} m²</div>`
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

          clearStoreHover();
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
          const popupSqmValue =
            props.sqm != null && Number.isFinite(Number(props.sqm))
              ? Number(props.sqm)
              : null;
          const sqmLine = popupSqmValue != null
            ? `<div style="margin-top:4px;color:#0f172a;font-weight:500">${popupSqmValue.toLocaleString()} m²</div>`
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

          clearStoreHover();
          focusStore(props, e.lngLat.lng, e.lngLat.lat);
        });

        map.on("mouseenter", "store-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mousemove", "store-points", handleStoreHover);
        map.on("mouseleave", "store-points", () => {
          map.getCanvas().style.cursor = "";
          clearStoreHover();
        });
        map.on("mouseenter", "store-points-highlight", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mousemove", "store-points-highlight", handleStoreHover);
        map.on("mouseleave", "store-points-highlight", () => {
          map.getCanvas().style.cursor = "";
          clearStoreHover();
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
            clearStoreHover();
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
          clearStoreHover();
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
            const competitionMap = new Map<string, BusinessProperties[]>();
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

                const businessFeature: GeoJSON.Feature<
                  GeoJSON.Point,
                  BusinessProperties
                > = {
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
                };

                const entries = competitionMap.get(store.Department_Name) ?? [];
                entries.push(businessFeature.properties);
                competitionMap.set(store.Department_Name, entries);

                return businessFeature;
              });
            });

            businessFeaturesRef.current = features;
            storeCompetitionLookup.current = competitionMap;

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
    clearPopulationHover,
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

    const visibility = populationOverlayEnabled ? "visible" : "none";
    const applyVisibility = (layerId: string) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    };

    applyVisibility(POPULATION_FILL_LAYER_ID);
    applyVisibility(POPULATION_OUTLINE_LAYER_ID);
    applyVisibility(POPULATION_HOVER_LAYER_ID);
    applyVisibility(POPULATION_CLUSTER_LAYER_ID);
    applyVisibility(POPULATION_CLUSTER_COUNT_LAYER_ID);
    applyVisibility(POPULATION_CLUSTER_UNCLUSTERED_LAYER_ID);

    if (map.getLayer(POPULATION_FILL_LAYER_ID)) {
      map.setPaintProperty(
        POPULATION_FILL_LAYER_ID,
        "fill-opacity",
        populationOverlayEnabled ? populationOverlayOpacity : 0
      );
    }

    const clusterOpacity = populationOverlayEnabled
      ? Math.min(0.9, populationOverlayOpacity + 0.2)
      : 0;
    const singleOpacity = populationOverlayEnabled
      ? Math.min(0.85, populationOverlayOpacity + 0.15)
      : 0;

    if (map.getLayer(POPULATION_CLUSTER_LAYER_ID)) {
      map.setPaintProperty(
        POPULATION_CLUSTER_LAYER_ID,
        "circle-opacity",
        clusterOpacity
      );
    }

    if (map.getLayer(POPULATION_CLUSTER_UNCLUSTERED_LAYER_ID)) {
      map.setPaintProperty(
        POPULATION_CLUSTER_UNCLUSTERED_LAYER_ID,
        "circle-opacity",
        singleOpacity
      );
    }

    if (!populationOverlayEnabled) {
      clearPopulationHover();
    }
  }, [
    populationOverlayEnabled,
    populationOverlayOpacity,
    clearPopulationHover,
  ]);

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

  const focusedCatchmentPopulation = useMemo(() => {
    if (!focusedStore) {
      return null;
    }

    const storeKey =
      focusedStore.departmentCode && focusedStore.departmentCode.trim().length > 0
        ? focusedStore.departmentCode.trim()
        : focusedStore.department;

    const candidate = storeCatchmentPopulations.get(storeKey);
    return candidate ?? null;
  }, [focusedStore, storeCatchmentPopulations]);

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

  const handleCatchmentRadiusChange = (
    _event: Event,
    value: number | number[]
  ) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    const clamped = Math.max(1, Math.min(25, Math.round(numericValue)));
    setCatchmentRadiusKm(clamped);
  };

  useEffect(() => {
    populationOverlayEnabledRef.current = populationOverlayEnabled;
  }, [populationOverlayEnabled]);

  useEffect(() => {
    populationOverlayOpacityRef.current = populationOverlayOpacity;
  }, [populationOverlayOpacity]);

  useEffect(() => {
    catchmentRadiusRef.current = catchmentRadiusKm;
  }, [catchmentRadiusKm]);

  useEffect(() => {
    const entries = populationCellEntriesRef.current;
    if (entries.length === 0 || storesData.length === 0) {
      const empty = new Map<string, number>();
      storeCatchmentPopulationsRef.current = empty;
      setStoreCatchmentPopulations(empty);
      return;
    }

    const radius = catchmentRadiusKm;
    const results = new Map<string, number>();

    for (const store of storesData) {
      if (store.Longitude == null || store.Latitude == null) {
        continue;
      }

      const center: [number, number] = [store.Longitude, store.Latitude];
      const catchmentFeature = circle(center, radius, {
        units: "kilometers",
        steps: CATCHMENT_BUFFER_STEPS,
      }) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
      const [minLng, minLat, maxLng, maxLat] = bbox(catchmentFeature);
      let totalPopulation = 0;

      for (const cell of entries) {
        if (cell.population <= 0) {
          continue;
        }

        const [cellMinLng, cellMinLat, cellMaxLng, cellMaxLat] = cell.bbox;
        if (
          cellMaxLng < minLng ||
          cellMinLng > maxLng ||
          cellMaxLat < minLat ||
          cellMinLat > maxLat
        ) {
          continue;
        }

        const centroidDistance = distance(cell.centroid, center, {
          units: "kilometers",
        });
        if (centroidDistance > radius + 1) {
          continue;
        }

        const overlap = intersect(catchmentFeature, cell.feature);
        if (!overlap) {
          continue;
        }

        const overlapArea = area(overlap);
        if (!Number.isFinite(overlapArea) || overlapArea <= 0) {
          continue;
        }

        const ratio = Math.min(1, overlapArea / cell.area);
        if (!Number.isFinite(ratio) || ratio <= 0) {
          continue;
        }

        totalPopulation += cell.population * ratio;
      }

      const storeKey =
        store.Department_Code && store.Department_Code.trim().length > 0
          ? store.Department_Code.trim()
          : store.Department_Name;

      results.set(storeKey, totalPopulation);
    }

    storeCatchmentPopulationsRef.current = results;
    setStoreCatchmentPopulations(results);
  }, [catchmentRadiusKm, storesData, populationDataVersion]);

  useEffect(() => {
    setStoreHoverDetails((current) => {
      if (!current) {
        return current;
      }

      const nextPopulation =
        storeCatchmentPopulations.get(current.store.code) ?? null;

      if (
        current.catchment.population === nextPopulation &&
        current.catchment.radiusKm === catchmentRadiusKm
      ) {
        return current;
      }

      return {
        ...current,
        catchment: {
          population: nextPopulation,
          radiusKm: catchmentRadiusKm,
        },
      };
    });
  }, [storeCatchmentPopulations, catchmentRadiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const applyCatchmentOverlay = () => {
      const source = map.getSource(
        STORE_CATCHMENT_SOURCE_ID
      ) as maplibregl.GeoJSONSource | null;
      if (!source) {
        return;
      }

      if (!focusedStore) {
        source.setData({ type: "FeatureCollection", features: [] });
        if (map.getLayer(STORE_CATCHMENT_FILL_LAYER_ID)) {
          map.setLayoutProperty(STORE_CATCHMENT_FILL_LAYER_ID, "visibility", "none");
        }
        if (map.getLayer(STORE_CATCHMENT_OUTLINE_LAYER_ID)) {
          map.setLayoutProperty(
            STORE_CATCHMENT_OUTLINE_LAYER_ID,
            "visibility",
            "none"
          );
        }
        return;
      }

      const catchmentFeature = circle(focusedStore.coordinates, catchmentRadiusKm, {
        units: "kilometers",
        steps: CATCHMENT_BUFFER_STEPS,
      });

      source.setData(catchmentFeature);
      if (map.getLayer(STORE_CATCHMENT_FILL_LAYER_ID)) {
        map.setLayoutProperty(STORE_CATCHMENT_FILL_LAYER_ID, "visibility", "visible");
      }
      if (map.getLayer(STORE_CATCHMENT_OUTLINE_LAYER_ID)) {
        map.setLayoutProperty(
          STORE_CATCHMENT_OUTLINE_LAYER_ID,
          "visibility",
          "visible"
        );
      }
    };

    if (!map.isStyleLoaded()) {
      map.once("load", applyCatchmentOverlay);
      return;
    }

    applyCatchmentOverlay();
  }, [focusedStore, catchmentRadiusKm]);

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
              pt: 1.75,
              pb: populationPanelExpanded ? 1.75 : 1.5,
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
                <Bolt sx={{ fontSize: 18, color: "primary.light" }} />
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 0.7, color: "rgba(148, 163, 184, 0.8)" }}
                >
                  Population density
                </Typography>
              </Stack>
              <IconButton
                size="small"
                aria-label={
                  populationPanelExpanded
                    ? "Collapse population density panel"
                    : "Expand population density panel"
                }
                aria-expanded={populationPanelExpanded}
                onClick={() =>
                  setPopulationPanelExpanded((previous) => !previous)
                }
                sx={{
                  ml: 1,
                  bgcolor: "rgba(30, 41, 59, 0.6)",
                  color: "rgba(148, 163, 184, 0.9)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  "&:hover": {
                    bgcolor: "rgba(30, 41, 59, 0.8)",
                  },
                }}
              >
                {populationPanelExpanded ? (
                  <ExpandLess fontSize="small" />
                ) : (
                  <ExpandMore fontSize="small" />
                )}
              </IconButton>
            </Stack>
            <Collapse in={populationPanelExpanded} timeout="auto" unmountOnExit>
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
                <Box sx={{ mt: 1.5 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
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
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.25,
                          borderRadius: 2,
                          backgroundColor: "rgba(30, 41, 59, 0.8)",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            color: "rgba(148, 163, 184, 0.7)",
                            fontWeight: 600,
                            mb: 0.75,
                          }}
                        >
                          Hover insight
                        </Typography>
                        {populationOverlayEnabled && populationHoverInfo ? (
                          <Stack spacing={0.75}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: "rgba(226, 232, 240, 0.95)",
                              }}
                            >
                              ~
                              {Math.round(
                                populationHoverInfo.population
                              ).toLocaleString()} people
                            </Typography>
                            <Stack direction="row" spacing={1.5}>
                              <Typography
                                variant="caption"
                                sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                              >
                                Density:
                                <Box component="span" sx={{ ml: 0.5 }}>
                                  {populationHoverInfo.density
                                    ? `${Math.round(
                                        populationHoverInfo.density
                                      ).toLocaleString()} people/km²`
                                    : "—"}
                                </Box>
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: "rgba(148, 163, 184, 0.75)" }}
                              >
                                Area:
                                <Box component="span" sx={{ ml: 0.5 }}>
                                  {populationHoverInfo.areaKm2
                                    ? `${populationHoverInfo.areaKm2.toFixed(
                                        populationHoverInfo.areaKm2 >= 10 ? 1 : 2
                                      )} km²`
                                    : "—"}
                                </Box>
                              </Typography>
                            </Stack>
                          </Stack>
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(148, 163, 184, 0.7)" }}
                          >
                            {populationOverlayEnabled
                              ? "Hover over the map to estimate people covered by each grid cell."
                              : "Enable the overlay to explore people per grid cell."}
                          </Typography>
                        )}
                      </Box>
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
                      <Divider
                        sx={{
                          mt: 2,
                          mb: 1.5,
                          borderColor: "rgba(148, 163, 184, 0.18)",
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "rgba(148, 163, 184, 0.75)",
                        }}
                      >
                        Catchment radius (km)
                      </Typography>
                      <Slider
                        size="small"
                        value={catchmentRadiusKm}
                        onChange={handleCatchmentRadiusChange}
                        step={1}
                        min={1}
                        max={25}
                        disabled={!populationOverlayAvailable}
                        sx={{
                          mt: 0.5,
                          color: "#60a5fa",
                          "& .MuiSlider-thumb": {
                            boxShadow: "0 0 0 4px rgba(96, 165, 250, 0.25)",
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 0.75,
                          display: "block",
                          color: "rgba(148, 163, 184, 0.75)",
                        }}
                      >
                        {populationOverlayAvailable
                          ? focusedStore
                            ? focusedCatchmentPopulation != null
                              ? `${focusedStore.department} reaches ${Math.round(
                                  focusedCatchmentPopulation
                                ).toLocaleString()} people within ${catchmentRadiusKm} km.`
                              : `${focusedStore.department} coverage is loading…`
                            : `Click a Viva Fresh store to reveal its ${catchmentRadiusKm} km reach.`
                          : "Population data required to estimate store catchments."}
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Collapse>
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
            <Box
              sx={{
                p: 2.5,
                pb: selectionPanelExpanded ? 0 : 2.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocationCity
                      sx={{ fontSize: 20, color: "primary.light" }}
                    />
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
                </Box>
                <IconButton
                  size="small"
                  aria-label={
                    selectionPanelExpanded
                      ? "Collapse selection details"
                      : "Expand selection details"
                  }
                  aria-expanded={selectionPanelExpanded}
                  onClick={() =>
                    setSelectionPanelExpanded((previous) => !previous)
                  }
                  sx={{
                    ml: 1,
                    bgcolor: "rgba(30, 41, 59, 0.6)",
                    color: "rgba(148, 163, 184, 0.9)",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    "&:hover": {
                      bgcolor: "rgba(30, 41, 59, 0.8)",
                    },
                  }}
                >
                  {selectionPanelExpanded ? (
                    <ExpandLess fontSize="small" />
                  ) : (
                    <ExpandMore fontSize="small" />
                  )}
                </IconButton>
              </Stack>
            </Box>
            <Collapse in={selectionPanelExpanded} timeout="auto" unmountOnExit>
              <Box>
                <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
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
                        sx={{
                          fontWeight: 600,
                          color: "rgba(167, 243, 208, 0.95)",
                        }}
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
                    displayedStores.map((store) => {
                      const coverageKey =
                        store.Department_Code && store.Department_Code.trim().length > 0
                          ? store.Department_Code.trim()
                          : store.Department_Name;
                      const coverageValue =
                        storeCatchmentPopulations.get(coverageKey) ?? null;

                      return (
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
                          {populationOverlayAvailable && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: "rgba(96, 165, 250, 0.85)",
                                mt: 0.35,
                                display: "block",
                              }}
                            >
                              {coverageValue != null
                                ? `≈ ${Math.round(coverageValue).toLocaleString()} people within ${catchmentRadiusKm} km`
                                : "Catchment coverage is loading"}
                            </Typography>
                          )}
                        </Box>
                      );
                    })
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
              </Box>
            </Collapse>
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
          pt: 1.75,
          pb: legendExpanded ? 1.75 : 1.5,
          borderRadius: 3,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          border: "1px solid rgba(148, 163, 184, 0.28)",
          color: "rgba(226, 232, 240, 0.9)",
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
            <MapOutlined sx={{ fontSize: 18, color: "primary.light" }} />
            <Typography variant="overline" sx={{ letterSpacing: 0.7 }}>
              Map legend
            </Typography>
          </Stack>
          <IconButton
            size="small"
            aria-label={
              legendExpanded ? "Collapse map legend" : "Expand map legend"
            }
            aria-expanded={legendExpanded}
            onClick={() => setLegendExpanded((previous) => !previous)}
            sx={{
              ml: 1,
              bgcolor: "rgba(30, 41, 59, 0.6)",
              color: "rgba(148, 163, 184, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.28)",
              "&:hover": {
                bgcolor: "rgba(30, 41, 59, 0.8)",
              },
            }}
          >
            {legendExpanded ? (
              <ExpandLess fontSize="small" />
            ) : (
              <ExpandMore fontSize="small" />
            )}
          </IconButton>
        </Stack>
        <Collapse in={legendExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 1 }}>
            <Stack spacing={1.25}>
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
              {focusedStore && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      bgcolor: "rgba(59, 130, 246, 0.18)",
                      border: "2px solid rgba(96, 165, 250, 0.8)",
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226, 232, 240, 0.85)" }}
                  >
                    {`${catchmentRadiusKm} km catchment`}
                  </Typography>
                </Stack>
              )}
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
          </Box>
        </Collapse>
      </Paper>

      {storeHoverDetails && (
        <Paper
          elevation={8}
          sx={{
            position: "absolute",
            left: storeHoverDetails.position.left,
            top: storeHoverDetails.position.top,
            zIndex: 2,
            pointerEvents: "none",
            px: 1.75,
            py: 1.5,
            borderRadius: 2,
            minWidth: 220,
            maxWidth: 260,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(148, 163, 184, 0.45)",
            color: "rgba(226, 232, 240, 0.95)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.4)",
          }}
        >
          <Stack spacing={0.75} sx={{ pointerEvents: "none" }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {storeHoverDetails.store.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "rgba(148, 163, 184, 0.8)" }}
              >
                {storeHoverDetails.store.city}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.9)" }}>
              Size: {" "}
              {storeHoverDetails.store.sqm != null
                ? `${storeHoverDetails.store.sqm.toLocaleString()} m²`
                : "Not specified"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.9)" }}>
              Population: {" "}
              {storeHoverDetails.population != null
                ? `${Math.round(storeHoverDetails.population).toLocaleString()} people`
                : "Data unavailable"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.9)" }}>
              Catchment ({Math.round(storeHoverDetails.catchment.radiusKm)} km): {" "}
              {storeHoverDetails.catchment.population != null
                ? `≈ ${Math.round(storeHoverDetails.catchment.population).toLocaleString()} people`
                : "Data unavailable"}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "rgba(226, 232, 240, 0.9)", fontWeight: 500 }}
            >
              Nearby competition: {" "}
              {storeHoverDetails.competition.total.toLocaleString()}
            </Typography>
            {storeHoverDetails.competition.categories.length > 0 ? (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: "wrap", mt: 0.5 }}
              >
                {storeHoverDetails.competition.categories.map(
                  ({ category, label, count }) => (
                    <Chip
                      key={category}
                      size="small"
                      icon={getCompetitionCategoryIcon(category)}
                      label={`${label} (${count})`}
                      sx={{
                        pointerEvents: "none",
                        bgcolor: "rgba(30, 41, 59, 0.6)",
                        color: "rgba(226, 232, 240, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.4)",
                      }}
                    />
                  )
                )}
              </Stack>
            ) : (
              <Typography
                variant="caption"
                sx={{ color: "rgba(148, 163, 184, 0.75)" }}
              >
                No nearby competition data yet.
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

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
