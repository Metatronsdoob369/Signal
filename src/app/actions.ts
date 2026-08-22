"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSiteSchema } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
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
  const parsed = createSiteSchema.safeParse({
    domain: formData.get("domain"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid domain" };
  }

  const { domain, name } = parsed.data;
  const existing = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
  if (existing.length > 0) {
    return { error: "Domain already registered" };
  }

  const token = generateSiteToken();
  await db.insert(sites).values({
    domain,
    name: name || domain,
    tokenHash: hashToken(token),
  });

  redirect(`/dashboard/${token}?new=1`);
}
