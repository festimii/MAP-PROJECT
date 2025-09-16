import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        o.Department_Code,
        o.Department_Name,
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        o.Region_Code,
        LTRIM(RTRIM(o.Region_Name)) AS Region_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s 
        ON o.Department_Code = s.Department_Code
      WHERE o.Department_Name IS NOT NULL
      ORDER BY TRY_CAST(o.Department_Code AS INT);  -- ✅ numeric order
    `);

    const zones = result.recordset.map((row) => ({
      Zone_Code: row.Department_Code, // ✅ Zone = Department_Code
      Zone_Name: row.Department_Name, // ✅ Zone = Department_Name
      Area_Code: row.Area_Code,
      Area_Name: row.Area_Name,
      City_Name: row.City_Name,
      Region_Code: row.Region_Code,
      Region_Name: row.Region_Name,
      SQM: row.SQM,
      Longitude: row.Longitude,
      Latitude: row.Latitude,
      Adresse: row.Adresse,
      Format: row.Format,
    }));

    res.json(zones);
  } catch (err) {
    console.error("❌ Error fetching zones:", err);
    res.status(500).send("Database error");
  }
});

export default router;
