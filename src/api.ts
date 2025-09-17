import axios from "axios";

// Base URL for backend API
const API = axios.create({
  baseURL: "http://localhost:4000/api", // change to http://192.168.100.63:4000 for LAN
  timeout: 5000,
});

// Cities
export const getCities = async () => {
  const res = await API.get("/cities");
  return res.data;
};

// Areas
export const getAreas = async () => {
  const res = await API.get("/areas");
  return res.data;
};

// Area filters
export const getAreaFilters = async () => {
  const res = await API.get("/areas/filters");
  return res.data;
};
