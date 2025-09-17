const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const getDefaultBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}/api`;
  }

  return "http://localhost:4000/api";
};

const rawBaseUrl =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim() ??
  getDefaultBaseUrl();

export const API_BASE_URL = normalizeBaseUrl(rawBaseUrl);

export const buildApiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
