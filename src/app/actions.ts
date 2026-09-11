"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSiteSchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { scheduleCrawlRefresh } from "@/lib/crawl/store";
import { MAX_TOKEN_LENGTH, REGISTER_GLOBAL_RATE, REGISTER_RATE } from "@/lib/hard-nos";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, registerDomainError } from "@/lib/tenant";
import { generatePublicKey, generateSiteToken, hashToken } from "@/lib/token";

export type CreateSiteState = {
  error?: string;
  token?: string;
  embedCode?: string;
  dashboardUrl?: string;
  domain?: string;
};

export async function createSite(
  _prev: CreateSiteState,
  formData: FormData,
): Promise<CreateSiteState> {
  const headerList = await headers();
  const ip = clientIp(headerList);
  if (
    !checkRateLimit("register:global", REGISTER_GLOBAL_RATE).ok ||
    !checkRateLimit(`register:${ip}`, REGISTER_RATE).ok
  ) {
    return { error: "Too many requests" };
  }

  const parsed = createSiteSchema.safeParse({
    domain: formData.get("domain"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    return { error: registerDomainError() };
  }

  const { domain, name } = parsed.data;
  const existing = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
  if (existing.length > 0) {
    return { error: registerDomainError() };
  }

  const token = generateSiteToken();
  const publicKey = generatePublicKey();
  try {
    const [created] = await db
      .insert(sites)
      .values({
        domain,
        name: name || domain,
        tokenHash: hashToken(token),
        publicKey,
      })
      .returning();
    scheduleCrawlRefresh({ id: created.id, domain: created.domain, crawlFactsAt: null });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: registerDomainError() };
    }
    throw error;
  }

  redirect(`/dashboard/${token}?new=1`);
}

/**
 * Dashboard switch for title/description experiments. Gated by the dashboard token, like the
 * dashboard itself. The form sends the state it wants ("on" or "off").
 */
export async function setExperimentsEnabled(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const enabled = formData.get("enabled") === "on";
  if (!token || token.length > MAX_TOKEN_LENGTH) notFound();

  const rows = await db.select().from(sites).where(eq(sites.tokenHash, hashToken(token))).limit(1);
  const site = rows[0];
  if (!site || !site.isActive) notFound();

  await db.update(sites).set({ experimentsEnabled: enabled }).where(eq(sites.id, site.id));
  redirect(`/dashboard/${token}`);
}
