import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        o.Department_Code,
        o.Department_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s ON o.Department_Code = s.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY o.Area_Code, o.Department_Name
    `);

    const grouped = {};
    result.recordset.forEach((row) => {
      if (!grouped[row.Area_Code]) {
        grouped[row.Area_Code] = {
          Area_Code: row.Area_Code,
          Area_Name: row.Area_Name,
          Cities: new Set(),
          Departments: [],
        };
      }

      if (row.City_Name) grouped[row.Area_Code].Cities.add(row.City_Name);

      grouped[row.Area_Code].Departments.push({
        Department_Code: row.Department_Code,
        Department_Name: row.Department_Name,
        SQM: row.SQM,
        Longitude: row.Longitude,
        Latitude: row.Latitude,
        Adresse: row.Adresse,
        Format: row.Format,
      });
    });

    const response = Object.values(grouped).map((area) => ({
      ...area,
      Cities: Array.from(area.Cities),
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching filters:", err);
    res.status(500).send("Database error");
  }
});

export default router;
