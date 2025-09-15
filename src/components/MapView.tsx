import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!mapContainer.current) return;

    const map: Map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [21, 42.6],
      zoom: 8,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      try {
        const res = await fetch("/kosovo-cities.geojson");
        if (!res.ok)
          return console.error("Failed to load kosovo-cities.geojson");
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

        // ✅ Default fill-color: blue for listed cities, gray for others
        const colorExpr: any[] = ["match", ["get", nameKey]];
        cities.forEach((c) => {
          colorExpr.push(c.City_Name, "#4b5563");
        });
        colorExpr.push("#4b5563");

        map.addLayer({
          id: "city-boundaries",
          type: "fill",
          source: "kosovo-cities",
          paint: {
            "fill-color": colorExpr,
            "fill-opacity": 0.35,
          },
        });

        map.addLayer({
          id: "city-borders",
          type: "line",
          source: "kosovo-cities",
          paint: { "line-color": "#111827", "line-width": 1.2 },
        });

        // ✅ Highlight overlay (3D extrusion)
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
        map.addLayer({
          id: "department-highlight",
          type: "circle",
          source: "stores",
          paint: {
            "circle-radius": 10,
            "circle-color": "#22c55e",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
          filter: ["==", "Department_Code", ""], // start empty
        });

        // ✅ Store points with city reference
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
                // pick City_Name if available, otherwise normalize Area_Name
                city: d.City_Name ?? d.Area_Name.replace(/ Area$/i, ""),
              },
            }));

          map.addSource("stores", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
          });

          map.addLayer({
            id: "store-points",
            type: "circle",
            source: "stores",
            paint: {
              "circle-radius": 6,
              "circle-color": "#ef4444",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
          });

          map.addLayer({
            id: "store-labels",
            type: "symbol",
            source: "stores",
            layout: {
              "text-field": ["get", "department"],
              "text-size": 13,
              "text-offset": [0, 1.2],
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
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
        }

        map.on("click", "city-boundaries", (e) => {
          if (!e.features?.length) return;
          const cityName = e.features[0].properties?.[nameKey];
          if (cityName) navigate(`/report/${encodeURIComponent(cityName)}`);
        });
      } catch (err) {
        console.error("Map load error:", err);
      }
    });

    return () => {
      map.remove();
    };
  }, [navigate, cities]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nameKey = (map as any).__cityNameKey;
    if (!nameKey || !map.getLayer("city-highlight")) return;

    let blinkInterval: NodeJS.Timeout | null = null;

    if (selected) {
      const selectedCities = Array.isArray(selected) ? selected : [selected];
      const normalized = selectedCities.map((c) => c.trim().toLowerCase());

      // Highlight polygons
      map.setFilter("city-highlight", ["in", nameKey, ...selectedCities]);

      // Fit bounds if single
      const src: any = map.getSource("kosovo-cities");
      if (src && src._data && selectedCities.length === 1) {
        const match = src._data.features.find(
          (f: any) => f.properties[nameKey] === selectedCities[0]
        );
        if (match) {
          const box = bbox(match);
          map.fitBounds(box as any, { padding: 40, duration: 800 });
        }
      }

      // ✅ Filter stores by normalized city name
      if (map.getLayer("store-points")) {
        map.setFilter("store-points", [
          "in",
          ["downcase", ["get", "city"]],
          ...normalized,
        ]);
      }
      if (map.getLayer("store-labels")) {
        map.setFilter("store-labels", [
          "in",
          ["downcase", ["get", "city"]],
          ...normalized,
        ]);
        map.setLayoutProperty("store-labels", "visibility", "visible");
      }
    } else {
      // Reset highlight
      map.setFilter("city-highlight", ["in", nameKey, ""]);

      // Reset stores
      if (map.getLayer("store-points")) {
        map.setFilter("store-points", null);
        map.setPaintProperty("store-points", "circle-opacity", 1);
      }
      if (map.getLayer("store-labels")) {
        map.setFilter("store-labels", null);
        map.setLayoutProperty(
          "store-labels",
          "visibility",
          map.getZoom() >= 12 ? "visible" : "none"
        );
      }
    }

    return () => {
      if (blinkInterval) clearInterval(blinkInterval);
    };
  }, [selected]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
