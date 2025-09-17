import { Router } from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { stat } from "fs/promises";
import pkg from "@ngageoint/geopackage";
import { parsePX } from "../utils/pxParser.js";
import { getPool } from "../db.js";

const { GeoPackageAPI } = pkg; // ✅ only use GeoPackageAPI

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POPULATION_GPKG_PATH = path.resolve(
  __dirname,
  "../../public/data/kontur_population_XK_20231101.gpkg"
);

const POPULATION_GPKG_TABLE = "population";

let cachedPopulationGeoJSON = null;
let cachedPopulationMtimeMs = null;
let populationLoadingPromise = null;

const loadPopulationGeoJSON = async () => {
  let fileStats;
  try {
    fileStats = await stat(POPULATION_GPKG_PATH);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      const missingError = new Error("Population GeoPackage not found");
      missingError.code = "ENOENT";
      throw missingError;
    }
    throw error;
  }

  if (
    cachedPopulationGeoJSON &&
    cachedPopulationMtimeMs === fileStats.mtimeMs
  ) {
    return cachedPopulationGeoJSON;
  }

  if (!populationLoadingPromise) {
    populationLoadingPromise = (async () => {
      const geoPackage = await GeoPackageAPI.open(POPULATION_GPKG_PATH);
      try {
        const featureDao = geoPackage.getFeatureDao(POPULATION_GPKG_TABLE);
        if (!featureDao) {
          const tableError = new Error(
            `Feature table "${POPULATION_GPKG_TABLE}" not found in GeoPackage`
          );
          tableError.code = "TABLE_NOT_FOUND";
          throw tableError;
        }

        const geometryColumnName = featureDao.getGeometryColumnName();
        const idColumnName = featureDao.idColumns?.[0] ?? null;

        const features = [];
        const iterator = featureDao.queryForEach();
        for (
          let iteratorResult = iterator.next();
          !iteratorResult.done;
          iteratorResult = iterator.next()
        ) {
          const featureRow = featureDao.getRow(iteratorResult.value);
          const geometryData = featureRow.geometry;

          if (
            !geometryData ||
            geometryData.geometryError ||
            geometryData.empty
          ) {
            continue;
          }

          const geometry = geometryData.toGeoJSON();
          if (!geometry) {
            continue;
          }

          const properties = {};
          for (const columnName of featureRow.columnNames) {
            if (columnName === geometryColumnName) {
              continue;
            }
            if (idColumnName && columnName === idColumnName) {
              continue;
            }

            const value = featureRow.getValueWithColumnName(columnName);
            if (value !== undefined) {
              properties[columnName] = value;
            }
          }

          const featureId =
            idColumnName !== null
              ? featureRow.getValueWithColumnName(idColumnName)
              : undefined;

          features.push({
            type: "Feature",
            id:
              featureId !== undefined && featureId !== null
                ? featureId
                : undefined,
            geometry,
            properties,
          });
        }

        const featureCollection = {
          type: "FeatureCollection",
          features,
        };

        cachedPopulationGeoJSON = featureCollection;
        cachedPopulationMtimeMs = fileStats.mtimeMs;
        return featureCollection;
      } finally {
        geoPackage.close();
      }
    })().finally(() => {
      populationLoadingPromise = null;
    });
  }

  return populationLoadingPromise;
};

// 🔹 Normalize names to match Storesqm.City_Name
function normalizeName(name) {
  return name
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/ë/g, "e")
    .trim()
    .toLowerCase();
}

// 🔹 Map ASK naming → Storesqm naming
const cityNameMap = {
  deqan: "Deqan",
  "fushe kosove": "Fushë Kosovë",
  komoran: "Komoran",
  pozhoran: "Pozhoran",
  rahovec: "Rahovec",
  kamenic: "Kamenicë",
  skenderaj: "Skenderaj",
  vushtrri: "Vushtrri",
};

// 🔹 Helper to find PX variable keys dynamically
function findVar(parsed, keyword) {
  const keys = Object.keys(parsed.variables || {});
  return keys.find((k) => k.toLowerCase().includes(keyword));
}

// -------------------------------------------------------
// 🚀 Import population data from ASK into PopulationData
// -------------------------------------------------------
router.post("/import", async (_req, res) => {
  try {
    const pool = await getPool();

    const url =
      "http://askdata.rks-gov.net/api/v1/sq/ASKdata/Census%20population/6_Sipas%20vendbanimeve/1%20Popullsia%20e%20komun%C3%ABs%20s%C3%AB%20De%C3%A7anit%20sipas%20vendbanimit/PopSex01.px";

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const text = Buffer.from(response.data).toString("utf8");

    const parsed = parsePX(text);

    if (!parsed || !parsed.variables || !parsed.data) {
      throw new Error("PX parsing failed: invalid structure");
    }

    // Dynamically detect variable keys
    const settlementKey = findVar(parsed, "vend");
    const yearKey = findVar(parsed, "vit");
    const genderKey = findVar(parsed, "gjin");

    if (!settlementKey || !yearKey || !genderKey) {
      console.log("Parsed variable keys:", Object.keys(parsed.variables));
      throw new Error("PX file missing Vendbanimi/Viti/Gjinia variables");
    }

    const settlements = parsed.variables[settlementKey] || [];
    const years = (parsed.variables[yearKey] || []).map((y) => parseInt(y, 10));
    const genders = parsed.variables[genderKey] || [];

    if (!settlements.length || !years.length || !genders.length) {
      throw new Error("Parsed PX file has empty variables");
    }

    const latestYear = Math.max(...years);
    let idx = 0;
    let inserted = 0;

    // Triple nested loop: settlement × year × gender
    for (const settlement of settlements) {
      for (const year of years) {
        for (const gender of genders) {
          const value = parseInt(parsed.data[idx++] || 0, 10);

          // ✅ Only insert the latest year
          if (year !== latestYear) continue;

          const norm = normalizeName(settlement);
          const mappedCity = cityNameMap[norm] || settlement;

          await pool
            .request()
            .input("City_Name", mappedCity)
            .input("Settlement", settlement)
            .input("Year", year)
            .input("Gender", gender)
            .input("Value", value).query(`
              MERGE PopulationData AS target
              USING (SELECT @City_Name AS City_Name, @Settlement AS Settlement, @Year AS Year, @Gender AS Gender) AS src
              ON target.City_Name = src.City_Name
                 AND target.Settlement = src.Settlement
                 AND target.Year = src.Year
                 AND target.Gender = src.Gender
              WHEN MATCHED THEN UPDATE SET Value = @Value
              WHEN NOT MATCHED THEN
                INSERT (City_Name, Settlement, Year, Gender, Value)
                VALUES (@City_Name, @Settlement, @Year, @Gender, @Value);
          `);

          inserted++;
        }
      }
    }

    res.json({ success: true, year: latestYear, inserted });
  } catch (err) {
    console.error("❌ Error importing population:", err);
    res.status(500).send("Database error");
  }
});

router.get("/grid", async (_req, res) => {
  try {
    const populationGeoJSON = await loadPopulationGeoJSON();
    res.json(populationGeoJSON);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      res.status(404).json({ error: "Population GeoPackage not found" });
      return;
    }

    console.error("❌ Error loading population GeoPackage:", error);
    res.status(500).json({ error: "Failed to load population GeoPackage" });
  }
});
// routes/population.js (add this for debugging)
router.get("/debug", async (_req, res) => {
  try {
    const url =
      "http://askdata.rks-gov.net/api/v1/sq/ASKdata/Census%20population/6_Sipas%20vendbanimeve/1%20Popullsia%20e%20komun%C3%ABs%20s%C3%AB%20De%C3%A7anit%20sipas%20vendbanimit/PopSex01.px";

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const text = Buffer.from(response.data).toString("utf8");

    // Return first 200 lines of the raw PX file
    const preview = text.split("\n").slice(0, 200).join("\n");

    res.type("text/plain").send(preview);
  } catch (err) {
    console.error("❌ Error fetching PX file:", err);
    res.status(500).send("Failed to fetch PX file");
  }
});

// -------------------------------------------------------
// 🚀 Join Storesqm with PopulationData
// -------------------------------------------------------
router.get("/by-store", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        s.Department_Code,
        s.Department_Name,
        s.City_Name,
        p.Year,
        p.Gender,
        p.Value
      FROM Storesqm s
      INNER JOIN PopulationData p 
        ON p.City_Name = s.City_Name
      ORDER BY s.City_Name, p.Year, p.Gender;
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error joining stores with population:", err);
    res.status(500).send("Database error");
  }
});

export default router;
