const rawApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;

if (typeof rawApiBaseUrl !== "string" || rawApiBaseUrl.length === 0) {
  throw new Error("VITE_API_BASE_URL is required");
}

let parsedApiBaseUrl: URL;

try {
  parsedApiBaseUrl = new URL(rawApiBaseUrl);
} catch {
  throw new Error("VITE_API_BASE_URL must be a valid URL");
}

export const env = {
  apiBaseUrl: parsedApiBaseUrl.href.replace(/\/$/, ""),
};
