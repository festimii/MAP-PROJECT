import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
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
    console.error("❌ Error fetching areas:", err);
    res.status(500).send("Database error");
  }
});

export default router;
