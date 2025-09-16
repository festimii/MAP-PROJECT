import { Router } from "express";
import { getPool } from "../db.js";

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

async function fetchOSMBusinesses(lat, lon, radius = 500) {
  const query = buildOverpassQuery(lat, lon, radius);
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: query,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("❌ OSM returned non-JSON:", text.slice(0, 200));
    return [];
  }

  return data.elements
    .filter((el) => el.type === "node" && el.tags)
    .map((el) => ({
      OSM_Id: el.id,
      Name: el.tags.name || "Unknown",
      Category: el.tags.amenity || el.tags.shop || "other",
      Latitude: el.lat,
      Longitude: el.lon,
      Address: el.tags["addr:street"] || null,
    }));
}

async function saveBusinessesToDB(pool, departmentCode, businesses) {
  for (const b of businesses) {
    await pool
      .request()
      .input("Store_Department_Code", departmentCode)
      .input("OSM_Id", b.OSM_Id)
      .input("Name", b.Name)
      .input("Category", b.Category)
      .input("Latitude", b.Latitude)
      .input("Longitude", b.Longitude)
      .input("Address", b.Address).query(`
        INSERT INTO StoreNearbyBusiness
        (Store_Department_Code, OSM_Id, Name, Category, Latitude, Longitude, Address)
        VALUES (@Store_Department_Code, @OSM_Id, @Name, @Category, @Latitude, @Longitude, @Address)
      `);
  }
}

router.get("/stores-with-businesses", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT DISTINCT
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
        o.Zone_Code,
        LTRIM(RTRIM(o.Zone_Name)) AS Zone_Name,
        o.Department_Code,
        o.Department_Name,
        o.City_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s ON o.Department_Code = s.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name)));
    `);

    const enriched = [];

    for (const row of result.recordset) {
      let businesses = [];

      if (row.Latitude && row.Longitude) {
        // 1. Check cache
        const cached = await pool
          .request()
          .input("Store_Department_Code", row.Department_Code).query(`
            SELECT OSM_Id, Name, Category, Latitude, Longitude, Address, RetrievedAt
            FROM StoreNearbyBusiness
            WHERE Store_Department_Code = @Store_Department_Code
          `);

        if (cached.recordset.length > 0) {
          businesses = cached.recordset;
        } else {
          // 2. Fetch fresh
          businesses = await fetchOSMBusinesses(
            row.Latitude,
            row.Longitude,
            500
          );

          // 3. Save to DB
          if (businesses.length > 0) {
            await saveBusinessesToDB(pool, row.Department_Code, businesses);
          }

          // avoid hammering OSM → wait 1 second
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      enriched.push({ ...row, NearbyBusinesses: businesses });
    }

    res.json(enriched);
  } catch (err) {
    console.error("❌ Error combining SQL + OSM:", err);
    res.status(500).send("Server error");
  }
});

export default router;
