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
        o.City_Code,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        o.Department_Code,
        o.Department_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format,
        b.OSM_Id AS Business_OSM_Id,
        b.Name AS Business_Name,
        b.Category AS Business_Category,
        b.Latitude AS Business_Latitude,
        b.Longitude AS Business_Longitude,
        b.Address AS Business_Address,
        b.RetrievedAt AS Business_RetrievedAt
      FROM OrgUnitArea o
      LEFT JOIN Storesqm s
        ON o.Department_Code = s.Department_Code
      LEFT JOIN StoreNearbyBusiness b
        ON b.Store_Department_Code = o.Department_Code
      WHERE o.Area_Name IS NOT NULL
      ORDER BY
        o.Area_Code,
        TRY_CAST(o.Department_Code AS INT),
        b.Name;
    `);

    const areas = new Map();

    for (const row of result.recordset) {
      const areaCode = row.Area_Code;
      const areaName = row.Area_Name;
      const safeAreaName = (areaName || "Unknown").replace(/\s+/g, "_");
      const areaKey = areaCode || `AREA_${safeAreaName}`;

      if (!areas.has(areaKey)) {
        areas.set(areaKey, {
          Area_Code: areaCode,
          Area_Name: areaName,
          _departmentsMap: new Map(),
        });
      }

      const areaEntry = areas.get(areaKey);

      const departmentCode =
        row.Department_Code !== null && row.Department_Code !== undefined
          ? String(row.Department_Code).trim()
          : "";
      const safeDepartmentName = (row.Department_Name || "Unknown").replace(
        /\s+/g,
        "_"
      );
      const departmentKey =
        departmentCode.length > 0 ? departmentCode : `DEPT_${safeDepartmentName}`;

      if (!areaEntry._departmentsMap.has(departmentKey)) {
        areaEntry._departmentsMap.set(departmentKey, {
          data: {
            Department_Code: row.Department_Code,
            Department_Name: row.Department_Name,
            City_Code: row.City_Code,
            City_Name: row.City_Name,
            SQM: row.SQM,
            Longitude: row.Longitude,
            Latitude: row.Latitude,
            Adresse: row.Adresse,
            Format: row.Format,
            NearbyBusinesses: [],
          },
          businessIds: new Set(),
        });
      }

      const { data: department, businessIds } =
        areaEntry._departmentsMap.get(departmentKey);

      if (row.City_Code && !department.City_Code) {
        department.City_Code = row.City_Code;
      }
      if (row.City_Name && !department.City_Name) {
        department.City_Name = row.City_Name;
      }

      const osmId = row.Business_OSM_Id;
      if (osmId && !businessIds.has(osmId)) {
        department.NearbyBusinesses.push({
          OSM_Id: osmId,
          Name: row.Business_Name,
          Category: row.Business_Category,
          Latitude: row.Business_Latitude,
          Longitude: row.Business_Longitude,
          Address: row.Business_Address,
          RetrievedAt: row.Business_RetrievedAt,
        });
        businessIds.add(osmId);
      }
    }

    const response = Array.from(areas.values()).map((area) => ({
      Area_Code: area.Area_Code,
      Area_Name: area.Area_Name,
      Departments: Array.from(area._departmentsMap.values()).map(
        ({ data }) => data
      ),
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

export default router;
