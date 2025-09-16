import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        o.Zone_Code,
        LTRIM(RTRIM(o.Zone_Name)) AS Zone_Name,
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
      WHERE o.Zone_Name IS NOT NULL
      ORDER BY o.Zone_Code, o.Department_Name;
    `);

    const grouped = {};

    result.recordset.forEach((row) => {
      const zoneName = row.Zone_Name || "Unassigned";
      const zoneKey = row.Zone_Code || `ZONE_${zoneName.replace(/\s+/g, "_")}`;

      if (!grouped[zoneKey]) {
        grouped[zoneKey] = {
          Zone_Code: row.Zone_Code ?? null,
          Zone_Name: zoneName,
          Areas: new Set(),
          Cities: new Set(),
          Departments: [],
        };
      }

      if (row.Area_Name) {
        grouped[zoneKey].Areas.add(row.Area_Name);
      }
      if (row.City_Name) {
        grouped[zoneKey].Cities.add(row.City_Name);
      }

      grouped[zoneKey].Departments.push({
        Department_Code: row.Department_Code,
        Department_Name: row.Department_Name,
        SQM: row.SQM,
        Longitude: row.Longitude,
        Latitude: row.Latitude,
        Adresse: row.Adresse,
        Format: row.Format,
        Area_Code: row.Area_Code,
        Area_Name: row.Area_Name,
        City_Name: row.City_Name,
        Zone_Code: row.Zone_Code ?? null,
        Zone_Name: zoneName,
      });
    });

    const response = Object.values(grouped).map((zone) => ({
      Zone_Code: zone.Zone_Code,
      Zone_Name: zone.Zone_Name,
      Areas: Array.from(zone.Areas),
      Cities: Array.from(zone.Cities),
      Departments: zone.Departments,
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching zones:", err);
    res.status(500).send("Database error");
  }
});

export default router;
