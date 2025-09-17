const inferBrowserBaseUrl = () => {
  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }

  return `${window.location.origin}/api`;
};

const rawBaseUrl =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
  inferBrowserBaseUrl() ??
  "http://localhost:4000/api";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const buildApiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
