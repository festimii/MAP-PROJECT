import { type ReactNode, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Stack,
  Avatar,
  LinearProgress,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import {
  ArrowBack,
  Download,
  Groups,
  Public,
  Storefront,
  Insights,
  Timeline,
  Lightbulb,
  TrendingUp,
  Layers as LayersIcon,
  CheckCircleRounded,
  Map as MapIcon,
} from "@mui/icons-material";

interface StatCard {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  colors: { bg: string; border: string; icon: string };
}

interface InsightLayer {
  id: number;
  label: string;
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
  highlights: string[];
  gradient: string;
}

export default function ReportView() {
  const { city } = useParams<{ city: string }>();
  const navigate = useNavigate();

  const cityName = city ? decodeURIComponent(city) : "Overview";

  const reportData = useMemo(() => {
    const baseSeed =
      cityName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;

    const seededValue = (offset: number, min: number, max: number) => {
      const x = Math.sin(baseSeed + offset) * 10000;
      const fraction = x - Math.floor(x);
      return fraction * (max - min) + min;
    };

    const population = Math.round(seededValue(1, 65000, 320000));
    const area = Math.round(seededValue(2, 70, 280));
    const stores = Math.max(1, Math.round(seededValue(3, 4, 26)));
    const marketShare = Math.round(seededValue(4, 22, 68));
    const yoyGrowth = Number(seededValue(5, 3.5, 12.5).toFixed(1));
    const retentionRate = Math.round(seededValue(6, 56, 94));
    const dwellTime = Math.round(seededValue(7, 12, 34));
    const footTraffic = Math.round(seededValue(8, 58, 96));
    const basketSize = seededValue(9, 18, 43);
    const conversion = Math.round(seededValue(10, 52, 92));
    const loyaltyGrowth = Number(seededValue(11, 4, 10.5).toFixed(1));
    const opportunityConfidence = Math.round(seededValue(12, 68, 95));

    const stats: StatCard[] = [
      {
        label: "Residents Reached",
        value: new Intl.NumberFormat("en-US").format(population),
        helper: "Living within 10 km",
        icon: <Groups fontSize="small" />,
        colors: {
          bg: "rgba(59,130,246,0.14)",
          border: "rgba(59,130,246,0.35)",
          icon: "#60a5fa",
        },
      },
      {
        label: "Urban Footprint",
        value: `${area} km²`,
        helper: "Serviceable coverage",
        icon: <Public fontSize="small" />,
        colors: {
          bg: "rgba(14,165,233,0.14)",
          border: "rgba(14,165,233,0.3)",
          icon: "#38bdf8",
        },
      },
      {
        label: "Active Stores",
        value: `${stores}`,
        helper: "Operating Viva Fresh sites",
        icon: <Storefront fontSize="small" />,
        colors: {
          bg: "rgba(34,197,94,0.16)",
          border: "rgba(34,197,94,0.32)",
          icon: "#4ade80",
        },
      },
      {
        label: "Viva Fresh Share",
        value: `${marketShare}%`,
        helper: "Of total grocery spend",
        icon: <Insights fontSize="small" />,
        colors: {
          bg: "rgba(249,115,22,0.16)",
          border: "rgba(249,115,22,0.32)",
          icon: "#fb923c",
        },
      },
    ];

    const layers: InsightLayer[] = [
      {
        id: 1,
        label: "Layer 1",
        title: "Community Snapshot",
        description: `Understand who shops in ${cityName} and where demand is building.`,
        metrics: [
          {
            label: "Population density",
            value: `${Math.round(population / Math.max(area, 1))} people/km²`,
          },
          {
            label: "Annual growth",
            value: `${yoyGrowth}% influx`,
          },
        ],
        highlights: [
          `${Math.round(seededValue(13, 42, 67))}% of spend is driven by young families seeking weekly top-ups.`,
          `Average dwell time of ${dwellTime} minutes signals room for experiential zones.`,
        ],
        gradient:
          "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(236,72,153,0.08))",
      },
      {
        id: 2,
        label: "Layer 2",
        title: "Retail Footprint",
        description: `Map how Viva Fresh competes today across ${cityName}.`,
        metrics: [
          { label: "Store saturation", value: `${stores} locations in market` },
          { label: "Peak footfall", value: `${footTraffic}% between 4–7 PM` },
        ],
        highlights: [
          `Market share sits at ${marketShare}% with upside in western districts.`,
          `Avg. basket €${basketSize.toFixed(1)} emphasises strong fresh and grab-and-go mix.`,
        ],
        gradient:
          "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(14,165,233,0.08))",
      },
      {
        id: 3,
        label: "Layer 3",
        title: "Growth Moves",
        description: `Translate insights into an actionable roll-out plan.`,
        metrics: [
          { label: "Conversion rate", value: `${conversion}% shoppers purchasing` },
          {
            label: "Loyalty momentum",
            value: `${loyaltyGrowth.toFixed(1)}% program growth`,
          },
        ],
        highlights: [
          `Retain ${retentionRate}% of loyalty shoppers with hyper-localised bundles.`,
          `Priority micro-markets show ${Math.round(
            seededValue(14, 12, 24),
          )}% higher click & collect demand.`,
        ],
        gradient:
          "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(59,130,246,0.08))",
      },
    ];

    const opportunities = [
      {
        title: "Pilot express format near transport hubs",
        description: `Leverage the ${dwellTime}-minute dwell time to launch a curated express store that captures commuters.`,
      },
      {
        title: "Double down on loyalty activations",
        description: `Use the ${retentionRate}% loyalty base to introduce personalised offers and cross-channel reminders.`,
      },
      {
        title: "Partner with local producers",
        description: `Champion local suppliers to lift the €${basketSize.toFixed(
          1,
        )} basket size and differentiate the assortment.`,
      },
    ];

    return {
      stats,
      layers,
      opportunities,
      yoyGrowth,
      marketShare,
      retentionRate,
      dwellTime,
      opportunityConfidence,
    };
  }, [cityName]);

  const {
    stats,
    layers,
    opportunities,
    yoyGrowth,
    marketShare,
    retentionRate,
    dwellTime,
    opportunityConfidence,
  } = reportData;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: "100%", overflow: "auto" }}>
      <Box sx={{ maxWidth: 1100, mx: "auto", pb: 6 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate("/")}
          variant="text"
          sx={{ mb: 2 }}
        >
          Back to Map
        </Button>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            mb: 4,
            backgroundImage:
              "linear-gradient(135deg, rgba(30,64,175,0.25), rgba(236,72,153,0.12))",
            borderColor: "rgba(96,165,250,0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={2}
            >
              <Stack spacing={1}>
                <Chip
                  icon={<Insights fontSize="small" />}
                  label="Layered market report"
                  variant="outlined"
                  color="primary"
                  sx={{ alignSelf: "flex-start" }}
                />
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {cityName} opportunity outlook
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: "text.secondary", maxWidth: 680 }}
                >
                  {`A structured view of Viva Fresh performance and growth levers in ${cityName}. Market share currently sits at ${marketShare}% with room to unlock a ${yoyGrowth.toFixed(
                    1,
                  )}% uplift.`}
                </Typography>
              </Stack>

              <Button
                startIcon={<Download />}
                variant="contained"
                color="primary"
              >
                Export summary
              </Button>
            </Stack>

            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <Chip
                icon={<Timeline fontSize="small" />}
                label={`Market share ${marketShare}%`}
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<TrendingUp fontSize="small" />}
                label={`Projected uplift ${yoyGrowth.toFixed(1)}%`}
                variant="outlined"
              />
              <Chip
                icon={<Lightbulb fontSize="small" />}
                label={`Avg. dwell ${dwellTime} min`}
                variant="outlined"
                color="secondary"
              />
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "rgba(148,163,184,0.2)",
                    bgcolor: "rgba(15,23,42,0.45)",
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 1.2, color: "primary.light" }}
                  >
                    Projected YoY uplift
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600 }}>
                    {yoyGrowth.toFixed(1)}%
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 2 }}
                  >
                    Based on multi-layer demand modelling
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (yoyGrowth / 15) * 100)}
                    sx={{ height: 8, borderRadius: 999, mb: 1 }}
                  />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Confidence score: {opportunityConfidence}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "rgba(148,163,184,0.2)",
                    bgcolor: "rgba(15,23,42,0.45)",
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 1.2, color: "secondary.light" }}
                  >
                    Loyalty strength
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600 }}>
                    {retentionRate}%
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 2 }}
                  >
                    Share of shoppers engaged in Viva Fresh programs
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={retentionRate}
                    color="secondary"
                    sx={{ height: 8, borderRadius: 999, mb: 1 }}
                  />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Average dwell time holds at {dwellTime} minutes.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        <Grid container spacing={2}>
          {stats.map((stat) => (
            <Grid item xs={12} sm={6} md={3} key={stat.label}>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  height: "100%",
                  borderRadius: 3,
                  borderColor: stat.colors.border,
                  bgcolor: "rgba(15,23,42,0.6)",
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={{
                      bgcolor: stat.colors.bg,
                      border: "1px solid",
                      borderColor: stat.colors.border,
                      color: stat.colors.icon,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{ color: "text.secondary", letterSpacing: 1.2 }}
                    >
                      {stat.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {stat.helper}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 5, borderColor: "rgba(148,163,184,0.2)" }} />

        <Box component="section">
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
            <LayersIcon sx={{ color: "primary.light" }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Layered insights
            </Typography>
            <Chip label="Overview → Footprint → Growth" size="small" variant="outlined" />
          </Stack>

          <Stack spacing={3.5}>
            {layers.map((layer) => (
              <Paper
                key={layer.id}
                variant="outlined"
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 3,
                  backgroundImage: layer.gradient,
                  borderColor: "rgba(148,163,184,0.25)",
                }}
              >
                <Stack spacing={2.5}>
                  <Chip
                    icon={<LayersIcon fontSize="small" />}
                    label={layer.label}
                    variant="outlined"
                    size="small"
                    sx={{ alignSelf: "flex-start" }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {layer.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {layer.description}
                  </Typography>

                  <Grid container spacing={2}>
                    {layer.metrics.map((metric) => (
                      <Grid item xs={12} sm={6} key={metric.label}>
                        <Box
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "rgba(148,163,184,0.2)",
                            bgcolor: "rgba(15,23,42,0.4)",
                          }}
                        >
                          <Typography
                            variant="overline"
                            sx={{ color: "text.secondary" }}
                          >
                            {metric.label}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {metric.value}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  <Stack spacing={1.5}>
                    {layer.highlights.map((highlight) => (
                      <Stack
                        key={highlight}
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        <CheckCircleRounded
                          color="success"
                          fontSize="small"
                          sx={{ mt: 0.4 }}
                        />
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {highlight}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: 5, borderColor: "rgba(148,163,184,0.2)" }} />

        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, borderColor: "rgba(148,163,184,0.25)" }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Lightbulb sx={{ color: "warning.light" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Recommended next moves
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {`Prioritise these actions to unlock the projected ${yoyGrowth.toFixed(
                1,
              )}% uplift while maintaining today’s loyal shopper base.`}
            </Typography>

            <Stack spacing={1.75}>
              {opportunities.map((opportunity) => (
                <Stack
                  key={opportunity.title}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                >
                  <CheckCircleRounded
                    color="success"
                    fontSize="small"
                    sx={{ mt: 0.4 }}
                  />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {opportunity.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {opportunity.description}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ borderColor: "rgba(148,163,184,0.2)" }} />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Strategy confidence: {opportunityConfidence}% aligned with market
                potential.
              </Typography>
              <Button
                variant="contained"
                startIcon={<MapIcon />}
                onClick={() => navigate("/")}
              >
                Open interactive map
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
