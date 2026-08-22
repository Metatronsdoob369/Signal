import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createSiteSchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { generateSiteToken, hashToken } from "@/lib/token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid domain", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { domain, name } = parsed.data;
    const existing = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Domain already registered" },
        { status: 409 },
      );
    }

    const token = generateSiteToken();
    const [site] = await db
      .insert(sites)
      .values({
        domain,
        name: name || domain,
        tokenHash: hashToken(token),
      })
      .returning();

    const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
    const embedCode = `<script defer src="${origin}/api/pack?token=${token}"></script>`;

    return NextResponse.json({
      success: true,
      site: {
        id: site.id,
        domain: site.domain,
        name: site.name,
        token,
        embedCode,
        dashboardUrl: `${origin}/dashboard/${token}`,
      },
    });
  } catch (error) {
    console.error("[sites POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
