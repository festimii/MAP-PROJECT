import express from "express";
import cors from "cors";

// Import routes
import citiesRoutes from "./routes/cities.js";
import areasRoutes from "./routes/areas.js";
import regionsRoutes from "./routes/regions.js";
import filtersRoutes from "./routes/filters.js";
import zonesRoutes from "./routes/zones.js";
import osmRoutes from "./routes/osm.js";
import combinedRoutes from "./routes/combined.js";

const app = express();
const PORT = 4000;
const host = "0.0.0.0";

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/cities", citiesRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/regions", regionsRoutes);
app.use("/api/areas/filters", filtersRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/osm", osmRoutes);
app.use("/api/combined", combinedRoutes);

// Start server
app.listen(PORT, host, () => {
  console.log(`🚀 API running at http://${host}:${PORT}`);
});
