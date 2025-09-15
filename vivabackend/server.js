import express from "express";
import sql from "mssql";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Database configuration
const dbConfig = {
  user: "sa",
  password: "Vivaviva4000",
  server: "192.168.100.17",
  database: "KATRORI25", // 👈 replace with your real DB
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Test connection
sql
  .connect(dbConfig)
  .then(() => console.log("✅ Connected to SQL Server"))
  .catch((err) => console.error("❌ DB Connection Failed:", err));

// --- API ENDPOINTS ---

// Distinct Cities (spaces stripped)
app.get("/api/cities", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
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

// Combined Areas + Department + StoreSQM info
app.get("/api/areas", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
  SELECT DISTINCT 
    o.Area_Code,
    LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name))) AS Area_Name,
    o.Department_Code,
    o.Department_Name,
    o.City_Name,
    s.SQM,
    s.Longitude,
    s.Latitude,
    s.Adresse,
    s.Format
FROM OrgUnitArea o
LEFT JOIN Storesqm s ON o.Department_Code = s.Department_Code
WHERE o.Area_Name IS NOT NULL
ORDER BY LTRIM(RIGHT(o.Area_Name, LEN(o.Area_Name) - CHARINDEX('-', o.Area_Name)));
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching combined data:", err);
    res.status(500).send("Database error");
  }
});

// Distinct Regions
app.get("/api/regions", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT DISTINCT Region_Code, Region_Name 
                FROM OrgUnitArea
                WHERE Region_Name IS NOT NULL
                ORDER BY Region_Name`);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching regions:", err);
    res.status(500).send("Database error");
  }
});

// GET /api/areas/filters
app.get("/api/areas/filters", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

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
          Cities: new Set(), // ✅ collect multiple cities
          Departments: [],
        };
      }

      // collect distinct city names
      if (row.City_Name) grouped[row.Area_Code].Cities.add(row.City_Name);

      // push department details
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

    // convert Sets to arrays before sending JSON
    const response = Object.values(grouped).map((area) => ({
      ...area,
      Cities: Array.from(area.Cities),
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

// Start server
const PORT = 4000;
app.listen(PORT, () =>
  console.log(`🚀 API running at http://localhost:${PORT}`)
);
