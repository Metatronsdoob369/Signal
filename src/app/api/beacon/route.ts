import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { beaconPayloadSchema } from "@/contracts";
import { db } from "@/db";
import { audits, findings, sites } from "@/db/schema";
import { corsHeaders, requestOrigin } from "@/lib/cors";
import { scoreAudit } from "@/lib/scorer";
import { hashToken } from "@/lib/token";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(requestOrigin(request)),
  });
}

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request);
  const headers = corsHeaders(origin);

  try {
    const token =
      request.nextUrl.searchParams.get("token") ||
      request.headers.get("x-signal-token") ||
      "";

    const body = await request.json();
    const parsed = beaconPayloadSchema.safeParse({
      ...body,
      token: body.token || token,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400, headers },
      );
    }

    const payload = parsed.data;
    const siteToken = payload.token || token;
    if (!siteToken) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401, headers });
    }

    const siteRows = await db
      .select()
      .from(sites)
      .where(eq(sites.tokenHash, hashToken(siteToken)))
      .limit(1);

    if (siteRows.length === 0) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 404, headers });
    }

    const site = siteRows[0];
    const { scores, findings: auditFindings } = scoreAudit(payload);

    const [audit] = await db
      .insert(audits)
      .values({
        siteId: site.id,
        url: payload.url,
        seoScore: scores.seo.toString(),
        aioScore: scores.aio.toString(),
        performanceScore: scores.performance.toString(),
        accessibilityScore: scores.accessibility.toString(),
        bestPracticesScore: scores.bestPractices.toString(),
        overallScore: scores.overall.toString(),
        title: payload.metadata.title || null,
        metaDescription: payload.metadata.description || null,
        h1: payload.content.h1Texts[0] || null,
        canonical: payload.metadata.canonical || null,
        wordCount: payload.content.wordCount,
        imageCount: payload.content.imagesCount,
        imagesWithoutAlt: Math.max(0, payload.content.imagesCount - payload.content.imagesWithAlt),
        structuredDataCount: payload.aio.structuredDataCount,
        hasFaq: payload.aio.hasFAQ,
        hasHowTo: payload.aio.hasHowTo,
        hasClearDefinitions: payload.aio.hasClearDefinitions,
        questionCount: payload.aio.questionCount || payload.content.questionCount,
        payload: {
          metadata: payload.metadata,
          content: payload.content,
          structure: payload.structure,
          performance: payload.performance,
          accessibility: payload.accessibility,
          aio: payload.aio,
        },
      })
      .returning();

    if (auditFindings.length > 0) {
      await db.insert(findings).values(
        auditFindings.map((finding) => ({
          auditId: audit.id,
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          message: finding.message,
          fix: finding.fix ?? null,
        })),
      );
    }

    await db
      .update(sites)
      .set({
        lastAuditAt: new Date(),
        seoScore: scores.seo.toString(),
        aioScore: scores.aio.toString(),
        overallScore: scores.overall.toString(),
      })
      .where(eq(sites.id, site.id));

    return NextResponse.json(
      {
        success: true,
        auditId: audit.id,
        scores,
        findingsCount: auditFindings.length,
        findings: auditFindings.filter((f) => f.severity !== "info").slice(0, 10),
      },
      { headers },
    );
  } catch (error) {
    console.error("[beacon POST]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
