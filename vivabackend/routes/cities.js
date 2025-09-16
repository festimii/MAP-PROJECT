import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT
        City_Code,
        LTRIM(RTRIM(City_Name)) AS City_Name
      FROM OrgUnitArea
      WHERE City_Name IS NOT NULL
      ORDER BY LTRIM(RTRIM(City_Name))
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching cities:", err);
    res.status(500).send("Database error");
  }
});

router.get("/with-stores", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        o.City_Code,
        LTRIM(RTRIM(o.City_Name)) AS City_Name,
        o.Area_Code,
        LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
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
      WHERE o.City_Name IS NOT NULL
      ORDER BY
        LTRIM(RTRIM(o.City_Name)),
        o.Area_Code,
        TRY_CAST(o.Department_Code AS INT),
        b.Name;
    `);

    const cities = new Map();

    for (const row of result.recordset) {
      const cityCode =
        row.City_Code !== null && row.City_Code !== undefined
          ? String(row.City_Code).trim()
          : "";
      const cityName = row.City_Name;
      const safeCityName = (cityName || "Unknown").replace(/\s+/g, "_");
      const cityKey = cityCode.length > 0 ? cityCode : `CITY_${safeCityName}`;

      if (!cities.has(cityKey)) {
        cities.set(cityKey, {
          City_Code: row.City_Code,
          City_Name: cityName,
          Areas: new Set(),
          _storesMap: new Map(),
        });
      }

      const cityEntry = cities.get(cityKey);

      if (row.City_Code && !cityEntry.City_Code) {
        cityEntry.City_Code = row.City_Code;
      }
      if (cityName && !cityEntry.City_Name) {
        cityEntry.City_Name = cityName;
      }

      if (row.Area_Name) {
        cityEntry.Areas.add(row.Area_Name);
      }

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

      if (!cityEntry._storesMap.has(storeKey)) {
        cityEntry._storesMap.set(storeKey, {
          data: {
            Department_Code: row.Department_Code,
            Department_Name: row.Department_Name,
            Area_Code: row.Area_Code,
            Area_Name: row.Area_Name,
            City_Code: row.City_Code,
            City_Name: cityName,
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

      const storeEntry = cityEntry._storesMap.get(storeKey);
      const store = storeEntry.data;

      if (row.Area_Code && !store.Area_Code) {
        store.Area_Code = row.Area_Code;
      }
      if (row.Area_Name && !store.Area_Name) {
        store.Area_Name = row.Area_Name;
      }

      const osmId = row.Business_OSM_Id;
      if (osmId && !storeEntry.businessIds.has(osmId)) {
        store.NearbyBusinesses.push({
          OSM_Id: osmId,
          Name: row.Business_Name,
          Category: row.Business_Category,
          Latitude: row.Business_Latitude,
          Longitude: row.Business_Longitude,
          Address: row.Business_Address,
          RetrievedAt: row.Business_RetrievedAt,
        });
        storeEntry.businessIds.add(osmId);
      }
    }

    const response = Array.from(cities.values()).map((city) => ({
      City_Code: city.City_Code,
      City_Name: city.City_Name,
      Areas: Array.from(city.Areas),
      Stores: Array.from(city._storesMap.values()).map(({ data }) => data),
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching city stores:", err);
    res.status(500).send("Database error");
  }
});

export default router;
