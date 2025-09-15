import { useState, useEffect } from "react";
import { Card, CardActionArea, CardContent } from "@mui/material";
import {
  AppBar,
  Toolbar,
  Typography,
  CssBaseline,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Switch,
  FormControlLabel,
  createTheme,
  ThemeProvider,
  Button,
} from "@mui/material";
import { Menu as MenuIcon, LocationCity, Map } from "@mui/icons-material";
import { Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import MapView from "./components/MapView";
import ReportView from "./components/ReportView";

const drawerWidth = 300;

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#90caf9" },
    background: { default: "#121212", paper: "#1e1e1e" },
    divider: "#2c2c2c",
  },
  typography: { fontFamily: "Inter, Roboto, sans-serif", fontSize: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#444 #1e1e1e",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "#1e1e1e" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#444",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#666" },
        },
      },
    },
  },
});

type City = { City_Code: number; City_Name: string };
type Area = {
  Area_Code: string;
  Area_Name: string;
  Cities: string[];
  Departments: {
    Department_Code: string;
    Department_Name: string;
    SQM: number;
  }[];
};

export default function App() {
  const [filterByCity, setFilterByCity] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [cityList, setCityList] = useState<City[]>([]);
  const [areaList, setAreaList] = useState<Area[]>([]);
  const navigate = useNavigate();

  // Load cities and areas
  useEffect(() => {
    axios
      .get("http://localhost:4000/api/cities")
      .then((res) => setCityList(res.data));
    axios
      .get("http://localhost:4000/api/areas/filters")
      .then((res) => setAreaList(res.data));
  }, []);

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterByCity(event.target.checked);
    setSelectedItem(null);
  };

  const handleSelect = (item: any) => {
    setSelectedItem(item);
    if (filterByCity) {
      navigate(`/report/${encodeURIComponent(item.name)}`);
    }
  };

  const handleBack = () => {
    setSelectedItem(null);
  };

  // Sidebar content
  let drawerContent;
  if (!filterByCity && selectedItem) {
    // Detail mode (Area with departments)
    drawerContent = (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <Box sx={{ px: 2, py: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleBack}
            sx={{ mb: 2 }}
          >
            ← Back to Areas
          </Button>
          <Typography variant="h6">{selectedItem.name}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Cities: {selectedItem.cities.join(", ")}
          </Typography>
        </Box>

        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Departments
          </Typography>

          {selectedItem.Departments?.map((d: any) => (
            <Card
              key={d.Department_Code}
              variant="outlined"
              sx={{
                mb: 1.5,
                borderRadius: 2,
                bgcolor: "background.default",
                "&:hover": { boxShadow: 3, borderColor: "primary.main" },
              }}
            >
              <CardActionArea
                onClick={() => console.log("Selected department:", d)}
              >
                <CardContent>
                  <Typography variant="body2" fontWeight="bold">
                    {d.Department_Name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block" }}
                  >
                    Madhesia Pikes: {d.SQM}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>
    );
  } else {
    // City/Area list mode
    const items = filterByCity
      ? cityList.map((c) => ({ code: c.City_Code, name: c.City_Name }))
      : areaList.map((a) => ({
          code: a.Area_Code,
          name: a.Area_Name,
          cities: a.Cities,
          Departments: a.Departments,
        }));

    drawerContent = (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={filterByCity}
                onChange={handleToggle}
                color="primary"
              />
            }
            label={filterByCity ? "Filter by City" : "Filter by Area"}
          />
        </Box>

        <Box sx={{ px: 1, py: 1, flex: 1, overflowY: "auto" }}>
          <List disablePadding>
            {items.map((item) => (
              <ListItemButton
                key={item.code}
                selected={selectedItem && selectedItem.code === item.code}
                onClick={() => handleSelect(item)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "black",
                    "& .MuiListItemIcon-root": { color: "black" },
                  },
                }}
              >
                <ListItemIcon sx={{ color: "text.secondary" }}>
                  {filterByCity ? <LocationCity /> : <Map />}
                </ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 1, borderColor: "divider" }} />
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block" }}
          >
            © 2025 Viva Fresh
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <CssBaseline />

        {/* Navbar */}
        <AppBar
          position="fixed"
          elevation={1}
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ px: 3 }}>
            <MenuIcon sx={{ mr: 2, color: "primary.main" }} />
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: "bold", letterSpacing: 0.5 }}
            >
              🌍 Viva Fresh — Demografia
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Toolbar />
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Routes>
              <Route
                path="/"
                element={
                  <MapView
                    selected={
                      filterByCity ? selectedItem?.name : selectedItem?.cities
                    }
                    cities={cityList}
                  />
                }
              />
              <Route path="/report/:name" element={<ReportView />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
