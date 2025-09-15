import sql from "mssql";

const dbConfig = {
  user: "sa",
  password: "Vivaviva4000",
  server: "192.168.100.17",
  database: "KATRORI25",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export async function getPool() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    throw err;
  }
}
