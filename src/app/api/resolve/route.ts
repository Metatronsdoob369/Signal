import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { resolveQuerySchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { allowedBeaconOrigin, corsHeaders } from "@/lib/cors";
import { resolveVariant } from "@/lib/experiment/store";
import { BEACON_RATE } from "@/lib/hard-nos";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp, siteMayServe } from "@/lib/tenant";
import { hashToken } from "@/lib/token";

const RESOLVE_METHODS = "GET, OPTIONS";

function appOrigin(request: NextRequest): string {
  return process.env.APP_ORIGIN || request.nextUrl.origin;
}

async function loadSite(key: string) {
  if (!key || key.length > 128) return null;
  const rows = await db.select().from(sites).where(eq(sites.publicKey, key)).limit(1);
  const site = rows[0];
  if (!site || !siteMayServe(site)) return null;
  return site;
}

export async function OPTIONS(request: NextRequest) {
  const site = await loadSite(request.nextUrl.searchParams.get("key") || "");
  const allowOrigin = site
    ? allowedBeaconOrigin(request.headers.get("origin"), site.domain, appOrigin(request))
    : null;
  if (!allowOrigin) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin, RESOLVE_METHODS) });
}

export async function GET(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const parsed = resolveQuerySchema.safeParse({
    key: request.nextUrl.searchParams.get("key") ?? "",
    path: request.nextUrl.searchParams.get("path") ?? "/",
    t: request.nextUrl.searchParams.get("t") ?? "",
    d: request.nextUrl.searchParams.get("d") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const ip = requestIp(request);
  const rateKey = `resolve:${hashToken(parsed.data.key) || ip}`;
  if (!checkRateLimit(rateKey, BEACON_RATE).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const site = await loadSite(parsed.data.key);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const allowOrigin = allowedBeaconOrigin(originHeader, site.domain, appOrigin(request));
  if (originHeader && originHeader !== "null" && !allowOrigin) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const headers = allowOrigin ? corsHeaders(allowOrigin, RESOLVE_METHODS) : undefined;

  try {
    const resolved = await resolveVariant(site.id, parsed.data.path, parsed.data.t, parsed.data.d);
    if (!resolved) {
      return NextResponse.json({ error: "No variant" }, { status: 404, headers });
    }
    return NextResponse.json(resolved, { headers });
  } catch (error) {
    console.error("[resolve GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
