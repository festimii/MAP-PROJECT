import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        o.Region_Code,
        LTRIM(RTRIM(o.Region_Name)) AS Region_Name,
        o.Area_Code,
        CASE
          WHEN CHARINDEX('-', o.Area_Name) > 0 THEN
            LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name)))
          ELSE
            LTRIM(RTRIM(o.Area_Name))
        END AS Area_Name,
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
        AND o.Department_Name IS NOT NULL
      ORDER BY
        TRY_CAST(o.Region_Code AS INT),
        TRY_CAST(o.Area_Code AS INT),
        TRY_CAST(o.Department_Code AS INT);
    `);

    const stores = result.recordset.map((row) => {
      const areaName = row.Area_Name?.trim() || "Unknown area";
      const sanitizedAreaCode =
        row.Area_Code != null && String(row.Area_Code).trim().length > 0
          ? String(row.Area_Code).trim()
          : `AREA_${areaName.replace(/\s+/g, "_").toUpperCase()}`;
      const zoneName = row.Region_Name?.trim() || "Unassigned Zone";
      const zoneCode =
        row.Region_Code != null && String(row.Region_Code).trim().length > 0
          ? String(row.Region_Code).trim()
          : null;
      const departmentCodeRaw = String(row.Department_Code ?? "").trim();
      const departmentCode =
        departmentCodeRaw.length > 0
          ? departmentCodeRaw
          : `${sanitizedAreaCode}-UNKNOWN`;
      const departmentName = row.Department_Name?.trim() || "Unnamed store";
      const cityNameRaw = row.City_Name ? row.City_Name.trim() : "";
      const cityName = cityNameRaw.length > 0 ? cityNameRaw : null;
      const address = row.Adresse ? row.Adresse.trim() : null;
      const format = row.Format ? row.Format.trim() : null;

      return {
        Area_Code: sanitizedAreaCode,
        Area_Name: areaName,
        Zone_Code: zoneCode,
        Zone_Name: zoneName,
        Department_Code: departmentCode,
        Department_Name: departmentName,
        City_Name: cityName,
        SQM: row.SQM ?? null,
        Longitude: row.Longitude ?? null,
        Latitude: row.Latitude ?? null,
        Adresse: address,
        Format: format,
      };
    });

    res.json(stores);
  } catch (err) {
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

export default router;
