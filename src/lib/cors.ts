import { hostMatchesSite } from "@/lib/tenant";

export function corsHeaders(origin: string, methods = "POST, OPTIONS"): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, X-Signal-Token",
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
