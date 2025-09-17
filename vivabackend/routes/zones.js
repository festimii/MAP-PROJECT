import { Router } from "express";
import { getPool } from "../db.js";
import { mergeSubZoneData, parseSubZoneGeoJSON } from "../utils/subzones.js";

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
        o.City_Code,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        o.Region_Code,
        LTRIM(RTRIM(o.Region_Name)) AS Region_Name,
        s.SQM,
        s.Longitude,
        s.Latitude,
        s.Adresse,
        s.Format,
        sz.SubZone_Name,
        sz.GeoJSON AS SubZone_GeoJSON,
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
      LEFT JOIN SubZones sz
        ON sz.Store_Department_Code = o.Department_Code
      LEFT JOIN StoreNearbyBusiness b
        ON b.Store_Department_Code = o.Department_Code
      WHERE o.Department_Name IS NOT NULL
      ORDER BY
        TRY_CAST(o.Department_Code AS INT),
        b.Name;
    `);

    const storesMap = new Map();

    for (const row of result.recordset) {
      const departmentCode =
        row.Department_Code !== null && row.Department_Code !== undefined
          ? String(row.Department_Code).trim()
          : "";
      const safeDepartmentName = (row.Department_Name || "Unknown").replace(
        /\s+/g,
        "_"
      );
      const storeKey =
        departmentCode.length > 0 ? departmentCode : `DEPT_${safeDepartmentName}`;

      if (!storesMap.has(storeKey)) {
        storesMap.set(storeKey, {
          data: {
            Zone_Code: row.Department_Code,
            Zone_Name: row.Department_Name,
            Area_Code: row.Area_Code,
            Area_Name: row.Area_Name,
            City_Code: row.City_Code,
            City_Name: row.City_Name,
            Region_Code: row.Region_Code,
            Region_Name: row.Region_Name,
            SQM: row.SQM,
            Longitude: row.Longitude,
            Latitude: row.Latitude,
            Adresse: row.Adresse,
            Format: row.Format,
            SubZone_Name: row.SubZone_Name ?? null,
            SubZone_GeoJSON: parseSubZoneGeoJSON(row.SubZone_GeoJSON),
            NearbyBusinesses: [],
          },
          businessIds: new Set(),
        });
      }

      const entry = storesMap.get(storeKey);
      const store = entry.data;

      mergeSubZoneData(store, row.SubZone_Name, row.SubZone_GeoJSON);

      if (row.City_Code && !store.City_Code) {
        store.City_Code = row.City_Code;
      }
      if (row.City_Name && !store.City_Name) {
        store.City_Name = row.City_Name;
      }

      const osmId = row.Business_OSM_Id;
      if (osmId && !entry.businessIds.has(osmId)) {
        store.NearbyBusinesses.push({
          OSM_Id: osmId,
          Name: row.Business_Name,
          Category: row.Business_Category,
          Latitude: row.Business_Latitude,
          Longitude: row.Business_Longitude,
          Address: row.Business_Address,
          RetrievedAt: row.Business_RetrievedAt,
        });
        entry.businessIds.add(osmId);
      }
    }

    const zones = Array.from(storesMap.values()).map(({ data }) => data);

    res.json(zones);
  } catch (err) {
    console.error("❌ Error fetching zones:", err);
    res.status(500).send("Database error");
  }
});

export default router;
