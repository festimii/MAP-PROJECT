import { Router } from "express";

const router = Router();

function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json];
    (
      node["amenity"](around:${radius},${lat},${lon});
      node["shop"](around:${radius},${lat},${lon});
    );
    out body;
  `;
}

router.get("/businesses", async (req, res) => {
  const { lat, lon, radius = 1000 } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  try {
    const query = buildOverpassQuery(lat, lon, radius);

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    const data = await response.json();

    const businesses = data.elements
      .filter((el) => el.type === "node" && el.tags)
      .map((el) => ({
        id: el.id,
        name: el.tags.name || "Unknown",
        category: el.tags.amenity || el.tags.shop || "other",
        latitude: el.lat,
        longitude: el.lon,
        address: el.tags["addr:street"] || null,
      }));

    res.json(businesses);
  } catch (err) {
    console.error("❌ Error fetching OSM data:", err);
    res.status(500).send("OSM API error");
  }
});

export default router;
