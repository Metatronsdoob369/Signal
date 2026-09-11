import { hostMatchesSite } from "@/lib/tenant";

export function corsHeaders(origin: string, methods = "POST, OPTIONS"): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
    // navigator.sendBeacon posts with credentials mode "include"; without this the browser fails
    // the CORS check on the response. The origin above is always a specific allow-listed origin, never *.
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function allowedBeaconOrigin(
  origin: string | null,
  siteDomain: string,
  appOrigin?: string,
): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (hostMatchesSite(parsed.hostname, siteDomain)) {
      return parsed.origin;
    }
    if (appOrigin && parsed.origin === new URL(appOrigin).origin) {
      return parsed.origin;
    }
  } catch {
    return null;
  }
  return null;
}
