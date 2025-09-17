import { Router } from "express";
import { getPool } from "../db.js";
import { mergeSubZoneData, parseSubZoneGeoJSON } from "../utils/subzones.js";

const router = Router();

router.get("/", async (_req, res) => {
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
        s.Format,
        sz.SubZone_Name,
        sz.GeoJSON AS SubZone_GeoJSON
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s
        ON o.Department_Code = s.Department_Code
      LEFT JOIN SubZones sz
        ON sz.Store_Department_Code = o.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY o.Area_Code, o.Department_Name;
    `);

    // ✅ Group by Area_Code
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

      const department = {
        Department_Code: row.Department_Code,
        Department_Name: row.Department_Name,
        SQM: row.SQM,
        Longitude: row.Longitude,
        Latitude: row.Latitude,
        Adresse: row.Adresse,
        Format: row.Format,
        City_Name: row.City_Name,
        Area_Code: row.Area_Code,
        Area_Name: row.Area_Name,
        SubZone_Name: row.SubZone_Name ?? null,
        SubZone_GeoJSON: parseSubZoneGeoJSON(row.SubZone_GeoJSON),
      };

      mergeSubZoneData(department, row.SubZone_Name, row.SubZone_GeoJSON);
      grouped[row.Area_Code].Departments.push(department);
    });

    const response = Object.values(grouped).map((area) => ({
      Area_Code: area.Area_Code,
      Area_Name: area.Area_Name,
      Cities: Array.from(area.Cities),
      Departments: area.Departments,
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

export default router;
