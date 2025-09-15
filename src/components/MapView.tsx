import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import bbox from "@turf/bbox";

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

type MapViewProps = {
  selected?: string | string[] | null;
  selectedDepartment?: {
    Department_Code: string;
    Department_Name: string;
  } | null;
  cities: { City_Code: number; City_Name: string }[];
};

export default function MapView({ selected, cities }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  // Initial map setup
  useEffect(() => {
    if (!mapContainer.current) return;

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

        (map as any).__cityNameKey = nameKey;
        map.addSource("kosovo-cities", { type: "geojson", data: geojson });

        const colorExpr: any[] = ["match", ["get", nameKey]];
        cities.forEach((c) => {
          colorExpr.push(c.City_Name, "#4b5563");
        });
        colorExpr.push("#4b5563");

        map.addLayer({
          id: "city-boundaries",
          type: "fill",
          source: "kosovo-cities",
          paint: { "fill-color": colorExpr, "fill-opacity": 0.35 },
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
            map.setLayoutProperty(
              "store-labels",
              "visibility",
              map.getZoom() >= 12 ? "visible" : "none"
            );
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
      map.remove();
    };
  }, [navigate, cities, darkMode]);

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
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
