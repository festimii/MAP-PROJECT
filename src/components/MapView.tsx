import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";

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

const normalizeName = (value: string) => value.toLowerCase().trim();

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

const createStoreBaseFilter = (): FilterSpecification =>
  ["!has", "point_count"] as unknown as FilterSpecification;

const createEmptyStoreHighlightFilter = (): FilterSpecification =>
  [
    "all",
    ["!has", "point_count"],
    ["==", "cityNormalized", "__none__"],
  ] as unknown as FilterSpecification;

const getStoreSelectionFilterContext = (
  selectionValue: MapSelection | null
): {
  highlightFilter: FilterSpecification;
  cityNames: string[];
} => {
  if (!selectionValue) {
    return {
      highlightFilter: createEmptyStoreHighlightFilter(),
      cityNames: [],
    };
  }

  switch (selectionValue.mode) {
    case "city":
      return {
        highlightFilter: [
          "all",
          ["!has", "point_count"],
          ["==", "cityNormalized", normalizeName(selectionValue.city)],
        ] as unknown as FilterSpecification,
        cityNames: [selectionValue.city],
      };
    case "area":
      return {
        highlightFilter: [
          "all",
          ["!has", "point_count"],
          ["==", "areaNormalized", normalizeName(selectionValue.area)],
        ] as unknown as FilterSpecification,
        cityNames: selectionValue.cities,
      };
    case "zone":
      return {
        highlightFilter: [
          "all",
          ["!has", "point_count"],
          ["==", "zoneNormalized", normalizeName(selectionValue.zone)],
        ] as unknown as FilterSpecification,
        cityNames: selectionValue.cities,
      };
    default:
      return {
        highlightFilter: createEmptyStoreHighlightFilter(),
        cityNames: [],
      };
  }
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
    const fallbackCity = store.City_Name && store.City_Name.trim().length > 0
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
  const [darkMode, setDarkMode] = useState(false);
  const businessFeaturesRef = useRef<
    GeoJSON.Feature<GeoJSON.Point, BusinessProperties>[]
  >([]);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    DEFAULT_COMPETITION_CATEGORY
  );
  const selectedCategoryRef = useRef(selectedCategory);
  const categorySelectionWasUserDriven = useRef(false);
  const cityGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const cityNameKeyRef = useRef<string | null>(null);
  const selectionRef = useRef<MapSelection | null>(null);
  const [storesData, setStoresData] = useState<StoreData[]>(stores ?? []);
  const initialStoresRef = useRef<StoreData[] | undefined>(stores);
  const previousSelectionHadValue = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const initialViewportRef = useRef({
    center: [21, 42.6] as [number, number],
    zoom: 7.5,
    pitch: 0,
    bearing: 0,
  });

  const filterBusinessFeaturesBySelection = useCallback(
    (
      features: GeoJSON.Feature<GeoJSON.Point, BusinessProperties>[],
      selectionValue: MapSelection | null
    ) => {
      if (!selectionValue) {
        return [];
      }

      if (features.length === 0) {
        return features;
      }

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
    },
    []
  );

  const refreshBusinessCategoryState = useCallback(
    (selectionValue: MapSelection | null) => {
      const relevantFeatures = filterBusinessFeaturesBySelection(
        businessFeaturesRef.current,
        selectionValue
      );

      const uniqueCategories = Array.from(
        new Set(
          relevantFeatures.map(
            (feature) => feature.properties.category
          )
        )
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
      const source = map.getSource("businesses") as maplibregl.GeoJSONSource | null;
      if (!source) {
        return;
      }

      const selectionValue = selectionRef.current;
      const relevantFeatures = filterBusinessFeaturesBySelection(
        businessFeaturesRef.current,
        selectionValue
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
    const {
      highlightFilter: storeHighlightFilter,
      cityNames: selectedCityNames,
    } = getStoreSelectionFilterContext(selectionValue);
    const storeBaseFilter = createStoreBaseFilter();

    const cleanedNames = Array.from(
      new Set(
        selectedCityNames
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      )
    );
    const hasCitySelection = cleanedNames.length > 0;

    const highlightFilter: FilterSpecification = hasCitySelection
      ? (["in", nameKey, ...cleanedNames] as unknown as FilterSpecification)
      : (["in", nameKey, ""] as unknown as FilterSpecification);

    const clusterVisibility = selectionValue ? "none" : "visible";
    const highlightVisibility = selectionValue ? "visible" : "none";

    const zoomLevel = map.getZoom();
    const showAllStoreLabels = zoomLevel >= STORE_LABEL_VISIBILITY_ZOOM;
    const storeLabelFilter = showAllStoreLabels
      ? createStoreBaseFilter()
      : storeHighlightFilter;
    const showCompetitionLabels =
      zoomLevel >= COMPETITION_LABEL_VISIBILITY_ZOOM;

    if (map.getLayer("store-points")) {
      map.setFilter("store-points", storeBaseFilter);
      map.setPaintProperty(
        "store-points",
        "circle-opacity",
        selectionValue ? 0.45 : 0.8
      );
      map.setPaintProperty(
        "store-points",
        "circle-color",
        selectionValue ? "#fb7185" : "#ef4444"
      );
    }

    if (map.getLayer("clusters")) {
      map.setLayoutProperty("clusters", "visibility", clusterVisibility);
    }

    if (map.getLayer("cluster-count")) {
      map.setLayoutProperty("cluster-count", "visibility", clusterVisibility);
    }

    map.setFilter("city-highlight", highlightFilter);

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

    const highlightLayerExists = Boolean(map.getLayer("store-points-highlight"));
    if (highlightLayerExists) {
      map.setFilter("store-points-highlight", storeHighlightFilter);
      map.setLayoutProperty(
        "store-points-highlight",
        "visibility",
        highlightVisibility
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
      map.setLayoutProperty("city-highlight", "visibility", highlightVisibility);
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
    } else if (!selectionValue && previousSelectionHadValue.current) {
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
    selectionRef.current = selection;
    applySelectionToMap();

    const map = mapRef.current;
    const nextCategory = refreshBusinessCategoryState(selection);

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
      const source = map.getSource("stores") as maplibregl.GeoJSONSource | null;
      if (source) {
        source.setData(buildStoreFeatureCollection(stores));
        applySelectionToMap();
      }
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

    setMapLoaded(false);
    businessFeaturesRef.current = [];
    setBusinessCategories([]);
    categorySelectionWasUserDriven.current = false;
    setSelectedCategory(DEFAULT_COMPETITION_CATEGORY);
    selectedCategoryRef.current = DEFAULT_COMPETITION_CATEGORY;

    const styleUrl = darkMode
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    const { center, zoom, pitch, bearing } = initialViewportRef.current;

    const map: MapLibreMap = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
      pitch,
      bearing,
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
            paint: { "fill-color": "#3b82f6", "fill-opacity": 0.6 },
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

        // --- Store points with clustering ---
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
          cluster: true,
          clusterRadius: 50,
        });

        // Cluster circles
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "stores",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#2563eb",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              15,
              10,
              20,
              50,
              25,
            ],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          },
        });

        // Cluster count labels
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "stores",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
          paint: {
            "text-color": "#fff",
          },
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
          filter: [
            "all",
            ["!has", "point_count"],
            ["==", "cityNormalized", "__none__"],
          ],
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
          filter: [
            "all",
            ["!has", "point_count"],
            ["==", "cityNormalized", "__none__"],
          ],
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
            const showAllStoreLabels =
              zoomLevel >= STORE_LABEL_VISIBILITY_ZOOM;
            const { highlightFilter } = getStoreSelectionFilterContext(
              selectionRef.current
            );
            const storeLabelFilter = showAllStoreLabels
              ? createStoreBaseFilter()
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

          // Popups for stores
          map.on("click", "store-points", (e) => {
            if (!e.features?.length) return;
            const props =
              e.features[0].properties as unknown as StoreFeatureProperties;
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
          });

          map.on("click", "store-points-highlight", (e) => {
            if (!e.features?.length) return;
            const props =
              e.features[0].properties as unknown as StoreFeatureProperties;
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

          map.on("click", "clusters", (event) => {
            if (!event.features?.length) return;
            const feature = event.features[0];
            const clusterId = feature.properties?.cluster_id;
            const source = map.getSource("stores") as maplibregl.GeoJSONSource & {
              getClusterExpansionZoom: (
                clusterIdValue: number,
                callback: (error: Error | null, zoom: number) => void
              ) => void;
            };

            if (!source || typeof clusterId !== "number") return;

            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (error) return;
              if (feature.geometry.type !== "Point") return;
              const [lng, lat] = feature.geometry.coordinates as [number, number];
              map.easeTo({ center: [lng, lat], zoom, duration: 600 });
            });
          });

          map.on("mouseenter", "clusters", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "clusters", () => {
            map.getCanvas().style.cursor = "";
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
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              3,
              12,
              7,
            ],
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
                } satisfies GeoJSON.Feature<
                  GeoJSON.Point,
                  BusinessProperties
                >;
              });
            });

            businessFeaturesRef.current = features;

            if (isMounted) {
              const categoryToUse = refreshBusinessCategoryState(
                selectionRef.current
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
            navigate(`/report/${encodeURIComponent(cityName)}`);
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
      } finally {
        applySelectionToMap();
        if (isMounted) {
          setMapLoaded(true);
        }
      }
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

  const selectionCompetition = useMemo(() => {
    if (!selection) {
      return null;
    }

    const relevantBusinesses = filterBusinessFeaturesBySelection(
      businessFeaturesRef.current,
      selection
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
  }, [selection, filterBusinessFeaturesBySelection]);

  const visibleCompetitionCount = useMemo(() => {
    if (!selection) {
      return 0;
    }

    const relevantBusinesses = filterBusinessFeaturesBySelection(
      businessFeaturesRef.current,
      selection
    );

    if (selectedCategory === DEFAULT_COMPETITION_CATEGORY) {
      return relevantBusinesses.length;
    }

    return relevantBusinesses.filter(
      (feature) => feature.properties?.category === selectedCategory
    ).length;
  }, [selection, selectedCategory, filterBusinessFeaturesBySelection]);

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

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const { center, zoom, pitch, bearing } = initialViewportRef.current;
    map.flyTo({
      center,
      zoom,
      pitch,
      bearing,
      speed: 0.6,
      curve: 1.3,
      easing: (t) => t,
      essential: true,
    });
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 3,
          width: 220,
          padding: "14px 16px",
          background: "rgba(17, 24, 39, 0.82)",
          color: "#f8fafc",
          borderRadius: 12,
          boxShadow: "0 16px 32px rgba(15,23,42,0.38)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          backdropFilter: "blur(8px)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(148, 163, 184, 0.75)",
          }}
        >
          View options
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            title={darkMode ? "Switch to light basemap" : "Switch to dark basemap"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(30, 41, 59, 0.92)",
              color: "#e2e8f0",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15,23,42,0.35)",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 14 }}>
              {darkMode ? "☀️" : "🌙"}
            </span>
            <span>{darkMode ? "Light basemap" : "Dark basemap"}</span>
          </button>
          <button
            type="button"
            onClick={handleResetView}
            title="Reset map view"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(30, 41, 59, 0.92)",
              color: "#e2e8f0",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15,23,42,0.35)",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 14 }}>
              🧭
            </span>
            <span>Reset view</span>
          </button>
        </div>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 11,
            color: "rgba(148, 163, 184, 0.78)",
            lineHeight: 1.45,
          }}
        >
          {selection
            ? "Use the competition filter to compare nearby activity."
            : "Choose a city, area or zone on the left to unlock insights."}
        </p>
      </div>
      {!mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2,
            padding: "12px 18px",
            background: "rgba(15, 23, 42, 0.88)",
            borderRadius: 12,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            boxShadow: "0 20px 40px rgba(15,23,42,0.45)",
            color: "#e2e8f0",
            pointerEvents: "none",
            textAlign: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            Loading basemap…
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(148,163,184,0.8)" }}>
            Preparing Viva Fresh layers
          </p>
        </div>
      )}
      {selectionSummary && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
            width: 320,
            maxHeight: "calc(100% - 20px)",
            overflow: "hidden",
            background: "rgba(17, 24, 39, 0.85)",
            color: "#f9fafb",
            borderRadius: "14px",
            boxShadow: "0 18px 45px rgba(15,23,42,0.45)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "16px 20px 12px" }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(148, 163, 184, 0.85)",
              }}
            >
              {selectionSummary.focusLabel}
            </span>
            <h3
              style={{
                margin: "6px 0 0",
                fontSize: 18,
                fontWeight: 600,
                color: "#f8fafc",
              }}
            >
              {selectionSummary.label}
            </h3>
            {selectionSummary.mode === "city" && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/report/${encodeURIComponent(selectionSummary.label)}`)
                }
                style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 9999,
                  border: "1px solid rgba(96,165,250,0.6)",
                  background: "rgba(191, 219, 254, 0.18)",
                  color: "#bae6fd",
                  cursor: "pointer",
                }}
              >
                Open layered report
              </button>
            )}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {selectionSummary.cities.map((city) => (
                <span
                  key={city}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    background: "rgba(59, 130, 246, 0.18)",
                    color: "rgba(191, 219, 254, 0.95)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {city}
                </span>
              ))}
            </div>
            {selectionSummary.mode === "zone" &&
              selectionSummary.areas.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: "rgba(148, 163, 184, 0.75)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Areas
                  </p>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {selectionSummary.areas.map((area) => (
                      <span
                        key={area}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 9999,
                          fontSize: 11,
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "rgba(191, 219, 254, 0.9)",
                          border: "1px solid rgba(59, 130, 246, 0.28)",
                        }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
          <div style={{ flex: "1 1 auto", overflowY: "auto" }}>
            <div
              style={{
                padding: "0 20px 12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  Stores
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#f1f5f9",
                  }}
                >
                  {selectionSummary.storeCount}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  Total SQM
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#f1f5f9",
                  }}
                >
                  {selectionSummary.totalSQM.toLocaleString()} m²
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  Geo coverage
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#f1f5f9",
                  }}
                >
                  {selectionSummary.storeCount > 0
                    ? `${Math.round(
                        (selectionSummary.geocodedCount /
                          selectionSummary.storeCount) *
                          100
                      )}%`
                    : "0%"}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  {selectionSummary.storeCount > 0
                    ? `${selectionSummary.geocodedCount}/${selectionSummary.storeCount} mapped`
                    : "0/0 mapped"}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "rgba(148, 163, 184, 0.75)",
                  }}
                >
                  Top formats
                </p>
                {selectionSummary.topFormats.length === 0 ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      color: "rgba(148, 163, 184, 0.7)",
                    }}
                  >
                    Mix coming soon
                  </p>
                ) : (
                  <ul
                    style={{
                      margin: "6px 0 0",
                      padding: 0,
                      listStyle: "none",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {selectionSummary.topFormats.map(({ format, count }) => (
                      <li
                        key={format}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "rgba(226, 232, 240, 0.85)",
                          background: "rgba(59, 130, 246, 0.12)",
                          border: "1px solid rgba(59, 130, 246, 0.18)",
                          borderRadius: 8,
                          padding: "6px 8px",
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{format}</span>
                        <span>{count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectionCompetition && (
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "rgba(148, 163, 184, 0.75)",
                    }}
                  >
                    Competition snapshot
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#f1f5f9",
                    }}
                  >
                    {selectionCompetition.total > 0
                      ? `${selectionCompetition.total.toLocaleString()} nearby location${
                          selectionCompetition.total === 1 ? "" : "s"
                        }`
                      : "No competition data yet"}
                  </p>
                  {selectionCompetition.topCategories.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {selectionCompetition.topCategories.map(
                        ({ category, label, count }) => (
                          <span
                            key={category}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              background: "rgba(16, 185, 129, 0.16)",
                              color: "rgba(167, 243, 208, 0.95)",
                              border: "1px solid rgba(16, 185, 129, 0.22)",
                              borderRadius: 9999,
                              padding: "4px 10px",
                            }}
                          >
                            {label}
                            <span
                              style={{
                                fontWeight: 600,
                                color: "rgba(16, 185, 129, 0.95)",
                                background: "rgba(16, 185, 129, 0.12)",
                                padding: "1px 6px",
                                borderRadius: 9999,
                              }}
                            >
                              {count}
                            </span>
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              padding: "12px 20px 18px",
              borderTop: "1px solid rgba(148, 163, 184, 0.25)",
              overflowY: "auto",
              maxHeight: 260,
            }}
          >
            {selectionSummary.storeCount === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#cbd5f5" }}>
                No Viva Fresh locations for this selection yet.
              </p>
            ) : (
              selectionSummary.stores.slice(0, 6).map((store) => (
                <div
                  key={store.Department_Code}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 13, color: "#f8fafc" }}>
                      {store.Department_Name}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(251, 191, 36, 0.9)",
                        background: "rgba(250, 204, 21, 0.1)",
                        padding: "2px 6px",
                        borderRadius: 9999,
                      }}
                    >
                      {store.Format ?? "Unspecified"}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "rgba(226, 232, 240, 0.75)",
                    }}
                  >
                    {store.Adresse ?? "Address coming soon"}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 11,
                      color: "rgba(148, 163, 184, 0.75)",
                    }}
                  >
                    {(store.SQM ?? 0).toLocaleString()} m² · {store.Area_Name}
                    {store.Zone_Name ? ` · ${store.Zone_Name}` : ""}
                  </p>
                </div>
              ))
            )}
            {selectionSummary.storeCount > 6 && (
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 11,
                  color: "rgba(148, 163, 184, 0.85)",
                }}
              >
                +{selectionSummary.storeCount - 6} additional location(s) in
                view.
              </p>
            )}
          </div>
        </div>
      )}
      {businessCategories.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 140,
            left: 10,
            zIndex: 2,
            width: 250,
            padding: "14px 16px",
            background: "rgba(17, 24, 39, 0.82)",
            color: "#f9fafb",
            borderRadius: "12px",
            boxShadow: "0 16px 35px rgba(15,23,42,0.4)",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(148, 163, 184, 0.75)",
              }}
            >
              Competition filter
            </span>
            <span
              style={{
                fontSize: 11,
                color: "rgba(148, 163, 184, 0.75)",
              }}
            >
              {visibleCompetitionCount.toLocaleString()} shown
            </span>
          </div>
          <select
            id="business-category"
            value={selectedCategory}
            onChange={(event) => {
              categorySelectionWasUserDriven.current = true;
              setSelectedCategory(event.target.value);
            }}
            aria-label="Business category filter"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(31, 41, 55, 0.9)",
              color: "#f8fafc",
              fontSize: "13px",
            }}
          >
            <option value="all">All categories</option>
            {businessCategories.map((category) => (
              <option key={category} value={category}>
                {humanizeCategory(category)}
              </option>
            ))}
          </select>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: "rgba(226, 232, 240, 0.75)",
            }}
          >
            {selectedCategory === DEFAULT_COMPETITION_CATEGORY
              ? "Showing all nearby businesses for this focus."
              : `Focusing on ${humanizeCategory(selectedCategory)} venues.`}
          </p>
          {visibleCompetitionCount === 0 && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: "rgba(148, 163, 184, 0.7)",
              }}
            >
              No mapped businesses for this filter yet.
            </p>
          )}
        </div>
      )}
      {!selectionSummary && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 300,
            maxWidth: "calc(100% - 40px)",
            background: "rgba(17, 24, 39, 0.82)",
            color: "#e2e8f0",
            padding: "18px 20px",
            borderRadius: 14,
            boxShadow: "0 18px 45px rgba(15,23,42,0.45)",
            border: "1px solid rgba(148, 163, 184, 0.32)",
            backdropFilter: "blur(6px)",
            zIndex: 2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(148, 163, 184, 0.75)",
            }}
          >
            Explore the network
          </p>
          <h3
            style={{
              margin: "8px 0 12px",
              fontSize: 18,
              fontWeight: 600,
              color: "#f8fafc",
            }}
          >
            Select a focus area to see store mix & competition
          </h3>
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                📊
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "rgba(226, 232, 240, 0.82)",
                  lineHeight: 1.5,
                }}
              >
                Use the sidebar filters to switch between city, area and zone perspectives.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                🗺️
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "rgba(226, 232, 240, 0.82)",
                  lineHeight: 1.5,
                }}
              >
                Click directly on a city boundary to open its dynamic report and animate the map focus.
              </p>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 20,
          zIndex: 2,
          width: 230,
          padding: "12px 16px",
          background: "rgba(17, 24, 39, 0.78)",
          color: "#f1f5f9",
          borderRadius: 12,
          boxShadow: "0 16px 32px rgba(15,23,42,0.38)",
          border: "1px solid rgba(148, 163, 184, 0.24)",
          backdropFilter: "blur(6px)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(148, 163, 184, 0.7)",
          }}
        >
          Map legend
        </p>
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid rgba(248, 250, 252, 0.7)",
                opacity: 0.85,
              }}
            />
            <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.85)" }}>
              Viva Fresh stores
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#f97316",
                border: "2px solid rgba(255, 255, 255, 0.8)",
              }}
            />
            <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.85)" }}>
              Focused stores
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#10b981",
                border: "2px solid rgba(248, 250, 252, 0.7)",
              }}
            />
            <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.85)" }}>
              Nearby competition
            </span>
          </div>
        </div>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 10,
            color: "rgba(148, 163, 184, 0.6)",
          }}
        >
          Zoom in to reveal detailed labels.
        </p>
      </div>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
