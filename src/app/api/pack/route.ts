import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { buildPackScript } from "@/lib/pack-script";
import { siteMayServe } from "@/lib/tenant";

const UNAVAILABLE = "// Signal pack: unavailable";

const packHeaders = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "private, no-store",
} as const;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key || key.length > 128) {
    return new NextResponse(UNAVAILABLE, { status: 404, headers: packHeaders });
  }

  const rows = await db.select().from(sites).where(eq(sites.publicKey, key)).limit(1);
  const site = rows[0];

  if (!site || !siteMayServe(site)) {
    return new NextResponse(UNAVAILABLE, { status: 404, headers: packHeaders });
  }

  const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
  const script = buildPackScript({ key, origin });

  return new NextResponse(script, {
    status: 200,
    headers: packHeaders,
  });
}
