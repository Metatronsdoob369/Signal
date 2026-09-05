"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSiteSchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { REGISTER_RATE } from "@/lib/hard-nos";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerDomainError } from "@/lib/tenant";
import { generateSiteToken, hashToken } from "@/lib/token";

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
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`register:${ip}`, REGISTER_RATE).ok) {
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
  try {
    await db.insert(sites).values({
      domain,
      name: name || domain,
      tokenHash: hashToken(token),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: registerDomainError() };
    }
    throw error;
  }

  redirect(`/dashboard/${token}?new=1`);
}
