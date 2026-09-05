import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, findings, sites } from "@/db/schema";
import { allowedBeaconOrigin, corsHeaders } from "@/lib/cors";
import { BEACON_RATE, MAX_BEACON_BYTES } from "@/lib/hard-nos";
import { parseBeaconPayload, readJsonCapped } from "@/lib/payload-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordExperimentEvents } from "@/lib/experiment/store";
import { scoreAudit } from "@/lib/scorer";
import { beaconBoundToSite, requestIp, siteMayServe } from "@/lib/tenant";
import { hashToken } from "@/lib/token";

function appOrigin(request: NextRequest): string {
  return process.env.APP_ORIGIN || request.nextUrl.origin;
}

function requestToken(request: NextRequest, bodyToken?: string): string {
  return (
    bodyToken ||
    request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-signal-token") ||
    ""
  );
}

async function loadSite(token: string) {
  if (!token) return null;
  const rows = await db.select().from(sites).where(eq(sites.tokenHash, hashToken(token))).limit(1);
  const site = rows[0];
  if (!site || !siteMayServe(site)) return null;
  return site;
}

export async function OPTIONS(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || request.headers.get("x-signal-token") || "";
  const site = await loadSite(token);
  const allowOrigin = site
    ? allowedBeaconOrigin(request.headers.get("origin"), site.domain, appOrigin(request))
    : null;
  if (!allowOrigin) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin) });
}

export async function POST(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const tokenHint =
    request.nextUrl.searchParams.get("token") || request.headers.get("x-signal-token") || "";
  const ip = requestIp(request);
  const rateKey = `beacon:${tokenHint ? hashToken(tokenHint) : ip}`;

  if (!checkRateLimit(rateKey, BEACON_RATE).ok) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const raw = await readJsonCapped(request, MAX_BEACON_BYTES);
    if (!raw.ok) {
      return NextResponse.json({ success: false, error: raw.error }, { status: 400 });
    }

    const body = raw.value && typeof raw.value === "object" ? (raw.value as Record<string, unknown>) : {};
    const parsed = parseBeaconPayload({
      ...body,
      token: typeof body.token === "string" ? body.token : tokenHint,
    });
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const siteToken = requestToken(request, parsed.payload.token);
    if (!siteToken) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }

    const site = await loadSite(siteToken);
    if (!site) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 404 });
    }

    const bound = beaconBoundToSite({
      url: parsed.payload.url,
      origin: originHeader && originHeader !== "null" ? originHeader : null,
      siteDomain: site.domain,
      appOrigin: appOrigin(request),
    });
    if (!bound.ok) {
      return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403 });
    }

    const allowOrigin = allowedBeaconOrigin(originHeader, site.domain, appOrigin(request));
    const headers = allowOrigin ? corsHeaders(allowOrigin) : undefined;

    if (parsed.payload.intent === "experiment") {
      const recorded = await recordExperimentEvents(site.id, parsed.payload);
      return NextResponse.json({ success: true, recorded }, { headers });
    }

    const { scores, findings: auditFindings } = scoreAudit(parsed.payload);

    const [audit] = await db
      .insert(audits)
      .values({
        siteId: site.id,
        url: parsed.payload.url,
        seoScore: scores.seo.toString(),
        aioScore: scores.aio.toString(),
        performanceScore: scores.performance.toString(),
        accessibilityScore: scores.accessibility.toString(),
        bestPracticesScore: scores.bestPractices.toString(),
        overallScore: scores.overall.toString(),
        title: parsed.payload.metadata.title || null,
        metaDescription: parsed.payload.metadata.description || null,
        h1: parsed.payload.content.h1Texts[0] || null,
        canonical: parsed.payload.metadata.canonical || null,
        wordCount: parsed.payload.content.wordCount,
        imageCount: parsed.payload.content.imagesCount,
        imagesWithoutAlt: Math.max(
          0,
          parsed.payload.content.imagesCount - parsed.payload.content.imagesWithAlt,
        ),
        structuredDataCount: parsed.payload.aio.structuredDataCount,
        hasFaq: parsed.payload.aio.hasFAQ,
        hasHowTo: parsed.payload.aio.hasHowTo,
        hasClearDefinitions: parsed.payload.aio.hasClearDefinitions,
        questionCount: parsed.payload.aio.questionCount || parsed.payload.content.questionCount,
        payload: {
          metadata: parsed.payload.metadata,
          content: parsed.payload.content,
          structure: parsed.payload.structure,
          performance: parsed.payload.performance,
          accessibility: parsed.payload.accessibility,
          aio: parsed.payload.aio,
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
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
