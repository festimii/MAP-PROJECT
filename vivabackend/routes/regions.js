import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT Region_Code, Region_Name 
      FROM OrgUnitArea
      WHERE Region_Name IS NOT NULL
      ORDER BY Region_Name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching regions:", err);
    res.status(500).send("Database error");
  }
});

export default router;
