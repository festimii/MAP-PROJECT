import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

type StoreData = {
  Area_Code: string;
  Area_Name: string;
  Department_Code: string;
  Department_Name: string;
  SQM: number;
  Longitude: number;
  Latitude: number;
  Adresse: string | null;
  Format: string | null;
  City_Name?: string;
};

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

type MapViewProps = {
  selected?: string | string[] | null;
  selectedDepartment?: {
    Department_Code: string;
    Department_Name: string;
  } | null;
  cities: { City_Code: number; City_Name: string }[];
};

const humanizeCategory = (value: string) =>
  value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Other";

export default function MapView({ selected, cities }: MapViewProps) {
  void selected;
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const businessFeaturesRef = useRef<
    GeoJSON.Feature<GeoJSON.Point, BusinessProperties>[]
  >([]);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    "supermarket"
  );
  const selectedCategoryRef = useRef(selectedCategory);

  const updateBusinessSource = useCallback(
    (map: Map, category: string) => {
      const source = map.getSource("businesses") as maplibregl.GeoJSONSource | null;
      if (!source) {
        return;
      }

      const features = businessFeaturesRef.current;
      const filtered =
        category === "all"
          ? features
          : features.filter((feature) => feature.properties.category === category);

    const featureCollection: GeoJSON.FeatureCollection<
      GeoJSON.Point,
      BusinessProperties
    > = {
      type: "FeatureCollection",
      features: filtered,
    };

    source.setData(featureCollection);
    },
    [businessFeaturesRef]
  );

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Initial map setup
  useEffect(() => {
    if (!mapContainer.current) return;

    businessFeaturesRef.current = [];
    setBusinessCategories([]);

    const styleUrl = darkMode
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    const map: Map = new maplibregl.Map({
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
    map.addControl(new maplibregl.NavigationControl(), "top-right");
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
        const storesRes = await fetch("http://localhost:4000/api/areas");
        if (storesRes.ok) {
          const stores: StoreData[] = await storesRes.json();
          const features: GeoJSON.Feature[] = stores
            .filter((d) => d.Longitude && d.Latitude)
            .map((d) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [d.Longitude, d.Latitude],
              },
              properties: {
                department: d.Department_Name,
                city: d.City_Name ?? d.Area_Name.replace(/ Area$/i, ""),
              },
            }));

          map.addSource("stores", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
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
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": 6,
              "circle-color": "#ef4444",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
          });

          // Store labels (toggle with zoom)
          map.addLayer({
            id: "store-labels",
            type: "symbol",
            source: "stores",
            filter: ["!", ["has", "point_count"]],
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

          map.on("zoom", () => {
            const showLabels = map.getZoom() >= 12;
            map.setLayoutProperty(
              "store-labels",
              "visibility",
              showLabels ? "visible" : "none"
            );
            if (map.getLayer("business-labels")) {
              map.setLayoutProperty(
                "business-labels",
                "visibility",
                showLabels ? "visible" : "none"
              );
            }
          });

          // Popups for stores
          map.on("click", "store-points", (e) => {
            if (!e.features?.length) return;
            const props = e.features[0].properties;
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<strong>${props.department}</strong><br>${props.city}`)
              .addTo(map);
          });
        }

        map.addSource("businesses", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "business-points",
          type: "circle",
          source: "businesses",
          paint: {
            "circle-radius": 5,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
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
            "http://localhost:4000/api/combined/stores-with-businesses"
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

            const uniqueCategories = Array.from(
              new Set(features.map((feature) => feature.properties.category))
            ).sort();

            if (isMounted) {
              setBusinessCategories(uniqueCategories);

              const preferredCategory = uniqueCategories.includes("supermarket")
                ? "supermarket"
                : uniqueCategories[0] ?? "all";
              const currentSelection = selectedCategoryRef.current;
              const nextCategory = uniqueCategories.length
                ? uniqueCategories.includes(currentSelection)
                  ? currentSelection
                  : preferredCategory
                : "all";

              if (nextCategory !== currentSelection) {
                setSelectedCategory(nextCategory);
              }

              updateBusinessSource(map, nextCategory);
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
      }
    });

    return () => {
      isMounted = false;
      map.remove();
    };
  }, [navigate, cities, darkMode, updateBusinessSource]);

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

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1,
          padding: "6px 12px",
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>
      {businessCategories.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 10,
            zIndex: 1,
            padding: "10px",
            background: "rgba(17, 24, 39, 0.85)",
            color: "#fff",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            minWidth: "220px",
          }}
        >
          <label
            htmlFor="business-category"
            style={{
              display: "block",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "6px",
              color: "#d1d5db",
            }}
          >
            Business Category
          </label>
          <select
            id="business-category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(31, 41, 55, 0.95)",
              color: "#f9fafb",
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
        </div>
      )}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
