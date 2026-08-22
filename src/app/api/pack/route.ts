import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { hashToken } from "@/lib/token";
import { buildPackScript } from "@/lib/pack-script";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse("// Signal pack: missing token", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const rows = await db
    .select()
    .from(sites)
    .where(eq(sites.tokenHash, hashToken(token)))
    .limit(1);

  if (rows.length === 0 || !rows[0].isActive) {
    return new NextResponse("// Signal pack: unknown token", {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
  const script = buildPackScript({ token, origin });

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
