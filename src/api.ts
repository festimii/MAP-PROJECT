import axios from "axios";

import { API_BASE_URL } from "./config/apiConfig";

// Base URL for backend API
const API = axios.create({
  baseURL: API_BASE_URL,
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
