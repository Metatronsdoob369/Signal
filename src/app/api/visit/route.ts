import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, sites, visitRollups, visits } from "@/db/schema";
import { allowedBeaconOrigin, corsHeaders } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rate-limit";
import { BEACON_RATE, MAX_BEACON_BYTES } from "@/lib/hard-nos";
import { assertNoPageContent, readJsonCapped } from "@/lib/payload-guard";
import { beaconBoundToSite, pageScope, requestIp, siteMayServe } from "@/lib/tenant";
import { hashToken } from "@/lib/token";
import { classifyReferrerHost } from "@/lib/traffic/referrers";

const METHODS = "POST, OPTIONS";

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
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin, METHODS) });
}

const count = z.number().int().nonnegative().max(1_000_000);
const millis = z.number().int().nonnegative().max(3_600_000);

const visitSchema = z.strictObject({
  key: z.string().max(256).optional(),
  id: z.string().min(6).max(64),
  path: z.string().min(1).max(2048),
  referrer: z.string().max(253).default(""),
  device: z.enum(["mobile", "tablet", "desktop"]).default("desktop"),
  vitals: z
    .strictObject({
      lcp: millis.optional(),
      inp: millis.optional(),
      cls: z.number().nonnegative().max(10).optional(),
    })
    .default({}),
  engagement: z.number().min(0).max(1).optional(),
  contacts: z
    .strictObject({
      mailto: count.default(0),
      tel: count.default(0),
      form: count.default(0),
      goal: count.default(0),
    })
    .default({ mailto: 0, tel: 0, form: 0, goal: 0 }),
});

export async function POST(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const keyHint = request.nextUrl.searchParams.get("key") || "";
  const ip = requestIp(request);
  const rateKey = `visit:${keyHint ? hashToken(keyHint) : ip}`;
  if (!checkRateLimit(rateKey, BEACON_RATE).ok) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const raw = await readJsonCapped(request, MAX_BEACON_BYTES);
    if (!raw.ok) {
      return NextResponse.json({ success: false, error: raw.error }, { status: 400 });
    }
    const content = assertNoPageContent(raw.value);
    if (!content.ok) {
      return NextResponse.json({ success: false, error: content.error }, { status: 400 });
    }
    const parsed = visitSchema.safeParse(raw.value);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }
    const body = parsed.data;

    const siteKey = (body.key && typeof body.key === "string" ? body.key : keyHint) || "";
    if (!siteKey) {
      return NextResponse.json({ success: false, error: "Missing key" }, { status: 401 });
    }
    const site = await loadSite(siteKey);
    if (!site) {
      return NextResponse.json({ success: false, error: "Site not found" }, { status: 404 });
    }

    const allowOrigin = allowedBeaconOrigin(originHeader, site.domain, appOrigin(request));
    const headers = allowOrigin ? corsHeaders(allowOrigin, METHODS) : undefined;

    const pageOrigin = originHeader && originHeader !== "null" ? originHeader : null;
    const syntheticUrl = pageOrigin ? `${pageOrigin.replace(/\/$/, "")}${body.path}` : `${appOrigin(request)}${body.path}`;
    const bound = beaconBoundToSite({
      url: syntheticUrl,
      origin: originHeader && originHeader !== "null" ? originHeader : null,
      siteDomain: site.domain,
      appOrigin: appOrigin(request),
    });
    if (!bound.ok) {
      return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403, headers });
    }
    const scope = pageScope(syntheticUrl, site.domain) ?? "app";
    if (scope !== "site") {
      // Do not record app-scope telemetry. Example page is excluded from site trends.
      return NextResponse.json({ success: true, recorded: 0, scope }, { headers });
    }

    // Upsert page for this site/path
    let pageRow = await db
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, site.id), eq(pages.path, body.path)))
      .orderBy(desc(pages.createdAt))
      .limit(1);
    if (pageRow.length === 0) {
      const [inserted] = await db
        .insert(pages)
        .values({ siteId: site.id, path: body.path })
        .returning();
      pageRow = [inserted];
    }
    const page = pageRow[0];

    // Insert or update visit by (siteId, clientVisitId)
    const values = {
      siteId: site.id,
      pageId: page.id,
      clientVisitId: body.id,
      path: body.path,
      referrerHost: body.referrer || "",
      referrerClass: classifyReferrerHost(body.referrer || ""),
      deviceClass: body.device,
      lcp: body.vitals.lcp ?? null,
      inp: body.vitals.inp ?? null,
      cls: body.vitals.cls ?? null,
      engagement: body.engagement ?? null,
      contactMailto: body.contacts.mailto ?? 0,
      contactTel: body.contacts.tel ?? 0,
      contactForm: body.contacts.form ?? 0,
      contactGoal: body.contacts.goal ?? 0,
    };

    await db
      .insert(visits)
      .values(values)
      .onConflictDoUpdate({
        target: [visits.siteId, visits.clientVisitId],
        set: {
          pageId: values.pageId,
          path: values.path,
          referrerHost: values.referrerHost,
          referrerClass: values.referrerClass,
          deviceClass: values.deviceClass,
          lcp: values.lcp,
          inp: values.inp,
          cls: values.cls,
          engagement: values.engagement,
          contactMailto: values.contactMailto,
          contactTel: values.contactTel,
          contactForm: values.contactForm,
          contactGoal: values.contactGoal,
        },
      });

    // Recompute today's rollup for this page (UTC day)
    const now = new Date();
    const dayKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Aggregate from visits for this page/day
    const result = await db.execute(sql<{
      visits: number;
      contacts: number;
      mailto: number;
      tel: number;
      form: number;
      goal: number;
      lcp_p75: number | null;
      inp_p75: number | null;
      cls_p75: string | null;
    }>`
      SELECT
        COUNT(*)::int AS visits,
        COALESCE(SUM(contact_mailto + contact_tel + contact_form + contact_goal), 0)::int AS contacts,
        COALESCE(SUM(contact_mailto), 0)::int AS mailto,
        COALESCE(SUM(contact_tel), 0)::int AS tel,
        COALESCE(SUM(contact_form), 0)::int AS form,
        COALESCE(SUM(contact_goal), 0)::int AS goal,
        (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY lcp) FROM visits WHERE page_id = ${page.id} AND created_at >= ${dayKey} AND created_at < ${sql.raw(
          "($1::timestamptz + interval '1 day')",
        )}) AS lcp_p75,
        (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY inp) FROM visits WHERE page_id = ${page.id} AND created_at >= ${dayKey} AND created_at < ${sql.raw(
          "($1::timestamptz + interval '1 day')",
        )}) AS inp_p75,
        (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY cls) FROM visits WHERE page_id = ${page.id} AND created_at >= ${dayKey} AND created_at < ${sql.raw(
          "($1::timestamptz + interval '1 day')",
        )})::text AS cls_p75
      FROM visits
      WHERE page_id = ${page.id}
        AND created_at >= ${dayKey}
        AND created_at < ${sql.raw("($1::timestamptz + interval '1 day')")}
    ` as any, [dayKey] as any);

    const agg = (result as unknown as { rows: any[] }).rows?.[0] ?? null;

    const rollupValues = {
      siteId: site.id,
      pageId: page.id,
      day: dayKey as any,
      visits: Number(agg?.visits ?? 0),
      contacts: Number(agg?.contacts ?? 0),
      mailto: Number(agg?.mailto ?? 0),
      tel: Number(agg?.tel ?? 0),
      form: Number(agg?.form ?? 0),
      goal: Number(agg?.goal ?? 0),
      lcpP75: agg?.lcp_p75 != null ? Math.round(Number(agg.lcp_p75)) : null,
      inpP75: agg?.inp_p75 != null ? Math.round(Number(agg.inp_p75)) : null,
      clsP75: agg?.cls_p75 != null ? Number(agg.cls_p75) : null,
    };

    await db
      .insert(visitRollups)
      .values(rollupValues)
      .onConflictDoUpdate({
        target: [visitRollups.pageId, visitRollups.day],
        set: {
          visits: rollupValues.visits,
          contacts: rollupValues.contacts,
          mailto: rollupValues.mailto,
          tel: rollupValues.tel,
          form: rollupValues.form,
          goal: rollupValues.goal,
          lcpP75: rollupValues.lcpP75,
          inpP75: rollupValues.inpP75,
          clsP75: rollupValues.clsP75,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true, recorded: 1, scope }, { headers });
  } catch (error) {
    console.error("[visit POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

