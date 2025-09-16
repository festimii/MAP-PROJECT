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

export default router;
