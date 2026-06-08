const DEFAULT_API_URL = "http://localhost:4000";

const normalizeApiBaseUrl = (value?: string) => value?.replace(/\/+$/, "") || "";

export const getServerApiUrl = () =>
  normalizeApiBaseUrl(process.env.NESTJS_API_URL) || DEFAULT_API_URL;

export const getClientApiUrl = () =>
  normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL) || "/api";

export const getApiUrl = () =>
  typeof window === "undefined" ? getServerApiUrl() : getClientApiUrl();

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiUrl()}${normalizedPath}`;
};
