import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/stores-with-businesses", async (_req, res) => {
  try {
    const pool = await getPool();

    // Fetch all stores
    const result = await pool.request().query(`
      SELECT DISTINCT
        o.Region_Code,
        LTRIM(RTRIM(o.Region_Name)) AS Region_Name,
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
        o.Department_Code,
        o.Department_Name,
        o.City_Code,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s ON o.Department_Code = s.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY o.Area_Code, o.Department_Code;
    `);

    const enriched = [];

    for (const row of result.recordset) {
      // ✅ Get businesses only from DB
      const businesses = await pool
        .request()
        .input("Store_Department_Code", row.Department_Code).query(`
     SELECT 
    OSM_Id, 
    Name, 
    Category, 
    Latitude, 
    Longitude, 
    Address, 
    RetrievedAt
FROM dbo.StoreNearbyBusiness
WHERE Store_Department_Code = @Store_Department_Code
  AND Category IN (
      -- Core Walmart-style retail formats
      'supermarket',
      'department_store',
      'variety_store',
      'mall',
      'marketplace',
      'general',

      -- In-store departments
      'clothes',
      'shoes',
      'fashion_accessories',
      'electronics',
      'computer',
      'mobile_phone',
      'furniture',
      'houseware',
      'kitchen',
      'toys',
      'books',
      'music',
      'video_games',
      'bakery',
      'confectionery',
      'pharmacy',
      'cosmetics',
      'beauty',
      'health_food',

      -- Extended retail categories
      'gift',
      'hardware',
      'greengrocer',
      'pet',
      'stationery',
      'sports'
  )
ORDER BY Category, Name;
        `);

      enriched.push({
        ...row,
        NearbyBusinesses: businesses.recordset || [],
      });
    }

    res.json(enriched);
  } catch (err) {
    console.error("❌ Error reading SQL:", err);
    res.status(500).send("Server error");
  }
});

export default router;
