import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Paper, Grid, Button } from "@mui/material";

export default function ReportView() {
  const { city } = useParams<{ city: string }>();
  const navigate = useNavigate();

  const stats = {
    population: Math.floor(Math.random() * 200000 + 50000),
    area: Math.floor(Math.random() * 200 + 50) + " km²",
    stores: Math.floor(Math.random() * 50 + 5),
    vivaShare: Math.floor(Math.random() * 70 + 20) + "%",
  };

  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: "bold", mb: 3 }}>
        📊 Report — {city}
      </Typography>

      <Grid container spacing={2}>
        {Object.entries(stats).map(([key, value]) => (
          <Grid item xs={12} md={6} key={key}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
                {key.toUpperCase()}
              </Typography>
              <Typography variant="h6">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Button variant="contained" sx={{ mt: 4 }} onClick={() => navigate("/")}>
        ⬅ Back to Map
      </Button>
    </Box>
  );
}
