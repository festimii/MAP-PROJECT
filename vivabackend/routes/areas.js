import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
        o.Department_Code,
        o.Department_Name,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s 
        ON o.Department_Code = s.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY o.Area_Code, o.Department_Code;
    `);

    // ✅ Group departments under their areas
    const grouped = {};
    result.recordset.forEach((row) => {
      const areaKey =
        row.Area_Code || `AREA_${row.Area_Name.replace(/\s+/g, "_")}`;

      if (!grouped[areaKey]) {
        grouped[areaKey] = {
          Area_Code: row.Area_Code,
          Area_Name: row.Area_Name,
          Departments: [],
        };
      }

      grouped[areaKey].Departments.push({
        Department_Code: row.Department_Code,
        Department_Name: row.Department_Name,
        City_Name: row.City_Name,
        SQM: row.SQM,
        Longitude: row.Longitude,
        Latitude: row.Latitude,
        Adresse: row.Adresse,
        Format: row.Format,
      });
    });

    const response = Object.values(grouped);

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

export default router;
