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

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    if (!response.ok) {
      throw new Error(
        `OSM API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

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
  } catch (err) {
    console.error(`❌ Failed fetching OSM data at [${lat},${lon}]`, err);
    return [];
  }
}

async function saveBusinesses(pool, departmentCode, businesses) {
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
        MERGE StoreNearbyBusiness AS target
        USING (SELECT 
            @Store_Department_Code AS Store_Department_Code,
            @OSM_Id AS OSM_Id
        ) AS source
        ON target.Store_Department_Code = source.Store_Department_Code
           AND target.OSM_Id = source.OSM_Id
        WHEN MATCHED THEN
          UPDATE SET 
            Name = @Name,
            Category = @Category,
            Latitude = @Latitude,
            Longitude = @Longitude,
            Address = @Address,
            RetrievedAt = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (Store_Department_Code, OSM_Id, Name, Category, Latitude, Longitude, Address, RetrievedAt)
          VALUES (@Store_Department_Code, @OSM_Id, @Name, @Category, @Latitude, @Longitude, @Address, SYSDATETIME());
      `);
  }
}

// ✅ New endpoint to trigger sync
router.post("/sync-all", async (_req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT Department_Code, Latitude, Longitude
      FROM Storesqm
      WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL
    `);

    let updatedStores = 0;
    let totalBusinesses = 0;

    for (const row of result.recordset) {
      const businesses = await fetchOSMBusinesses(
        row.Latitude,
        row.Longitude,
        500
      );

      if (businesses.length > 0) {
        await saveBusinesses(pool, row.Department_Code, businesses);
        updatedStores++;
        totalBusinesses += businesses.length;
        console.log(
          `✅ Store ${row.Department_Code}: ${businesses.length} businesses updated`
        );
      }

      // Throttle Overpass API
      await new Promise((r) => setTimeout(r, 1000));
    }

    res.json({
      message: "Sync completed",
      updatedStores,
      totalBusinesses,
    });
  } catch (err) {
    console.error("❌ Sync failed:", err);
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
});

export default router;
