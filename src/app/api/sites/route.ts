import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createSiteSchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { MAX_REGISTER_BYTES, REGISTER_RATE } from "@/lib/hard-nos";
import { readJsonCapped } from "@/lib/payload-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerDomainError, requestIp } from "@/lib/tenant";
import { generateSiteToken, hashToken } from "@/lib/token";

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request);
  if (!checkRateLimit(`register:${ip}`, REGISTER_RATE).ok) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const raw = await readJsonCapped(request, MAX_REGISTER_BYTES);
    if (!raw.ok) {
      return NextResponse.json({ success: false, error: registerDomainError() }, { status: 400 });
    }

    const parsed = createSiteSchema.safeParse(raw.value);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: registerDomainError() }, { status: 400 });
    }

    const { domain, name } = parsed.data;
    const existing = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: registerDomainError() }, { status: 400 });
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
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ success: false, error: registerDomainError() }, { status: 400 });
    }
    console.error("[sites POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
