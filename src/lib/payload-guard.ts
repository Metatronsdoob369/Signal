import { beaconPayloadSchema, type BeaconPayload } from "@/contracts";
import { FORBIDDEN_CONTENT_KEYS, MAX_BEACON_BYTES } from "@/lib/hard-nos";

export { FORBIDDEN_CONTENT_KEYS, MAX_BEACON_BYTES };

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_CONTENT_KEYS);
const HTML_DOCUMENT = /<!DOCTYPE\s+html|<html[\s>]/i;

export type GuardResult<T> = { ok: true; payload: T } | { ok: false; error: string };
export type SizeResult = { ok: true } | { ok: false; error: string };

export function assertBeaconSize(body: string): SizeResult {
  if (body.length > MAX_BEACON_BYTES) {
    return { ok: false, error: "Payload too large" };
  }
  return { ok: true };
}

export function assertNoPageContent(value: unknown, depth = 0): SizeResult {
  if (depth > 8) {
    return { ok: false, error: "Invalid payload" };
  }
  if (typeof value === "string") {
    if (HTML_DOCUMENT.test(value)) {
      return { ok: false, error: "Invalid payload" };
    }
    return { ok: true };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = assertNoPageContent(item, depth + 1);
      if (!nested.ok) return nested;
    }
    return { ok: true };
  }
  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
        return { ok: false, error: "Invalid payload" };
      }
      const nested = assertNoPageContent(nestedValue, depth + 1);
      if (!nested.ok) return nested;
    }
  }
  return { ok: true };
}

export function parseBeaconPayload(raw: unknown): GuardResult<BeaconPayload> {
  const content = assertNoPageContent(raw);
  if (!content.ok) return content;
  const parsed = beaconPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload" };
  }
  return { ok: true, payload: parsed.data };
}

export async function readJsonCapped(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, error: "Payload too large" };
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, error: "Payload too large" };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Invalid payload" };
  }
}
