import axios from "axios";

const DEFAULT_BASE_URL = "http://localhost:4000/api";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});
