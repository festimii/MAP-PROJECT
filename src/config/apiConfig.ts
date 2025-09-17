const rawBaseUrl =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:4000/api";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const buildApiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
