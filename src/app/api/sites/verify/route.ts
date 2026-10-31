import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";

type Body = {
  domain?: string;
  token?: string;
  method?: "dns" | "file";
};

async function verifyByFile(domain: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/.well-known/signal-verify.txt`, { method: "GET" });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text === token;
  } catch {
    return false;
  }
}

async function verifyByDns(domain: string, token: string): Promise<boolean> {
  // Lazy import to avoid pulling dns in edge builds if not used.
  const { promises: dns } = await import("node:dns");
  try {
    const txt = await dns.resolveTxt(`_signal.${domain}`);
    const flat = txt.map((parts) => parts.join(""));
    return flat.some((entry) => entry === token || entry === `signal-verify=${token}`);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  const domain = (body.domain || "").toLowerCase().trim();
  const token = (body.token || "").trim();
  const method = body.method || "dns";
  if (!domain || !token) {
    return NextResponse.json({ success: false, error: "Missing domain or token" }, { status: 400 });
  }

  const rows = await db
    .select({ id: sites.id, isVerified: sites.isVerified, verificationToken: sites.verificationToken })
    .from(sites)
    .where(and(eq(sites.domain, domain), eq(sites.verificationToken, token)))
    .limit(1);
  const site = rows[0];
  if (!site) {
    return NextResponse.json({ success: false, error: "Site not found" }, { status: 404 });
  }
  if (site.isVerified) {
    return NextResponse.json({ success: true, verified: true });
  }

  const ok = method === "file" ? await verifyByFile(domain, token) : await verifyByDns(domain, token);
  if (!ok) {
    return NextResponse.json({ success: false, error: "Verification not found" }, { status: 400 });
  }
  await db.update(sites).set({ isVerified: true }).where(and(eq(sites.domain, domain), eq(sites.verificationToken, token)));
  return NextResponse.json({ success: true, verified: true });
}

