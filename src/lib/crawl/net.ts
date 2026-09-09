import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LookupLike = (hostname: string) => Promise<string[]>;

/** Every address the hostname resolves to, v4 and v6, in resolver order. */
export const systemLookup: LookupLike = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true });
  return records.map((record) => record.address);
};

function parseV4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isPublicV4(address: string): boolean {
  const octets = parseV4(address);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

/** Expand an IPv6 literal to eight hextets, folding an embedded dotted IPv4 tail. */
function hextets(address: string): number[] | null {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseV4(tail);
    if (!v4) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (groups.length !== 8) return null;
  const values = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return values.some(Number.isNaN) ? null : values;
}

function isPublicV6(address: string): boolean {
  const h = hextets(address);
  if (!h) return false;
  const leadingZeros = h.slice(0, 5).every((value) => value === 0);
  if (h.every((value) => value === 0)) return false;
  if (leadingZeros && h[5] === 0 && h[6] === 0 && h[7] === 1) return false;
  if (leadingZeros && (h[5] === 0xffff || h[5] === 0)) {
    return isPublicV4(`${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`);
  }
  if ((h[0] & 0xfe00) === 0xfc00) return false;
  if ((h[0] & 0xffc0) === 0xfe80) return false;
  if ((h[0] & 0xff00) === 0xff00) return false;
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false;
  if (h[0] === 0x2002) return isPublicV4(`${h[1] >> 8}.${h[1] & 0xff}.${h[2] >> 8}.${h[2] & 0xff}`);
  if (h[0] === 0x0064 && h[1] === 0xff9b) return false;
  return true;
}

/** True only for addresses routable on the public internet. Unparseable input is not public. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicV4(address);
  if (family === 6) return isPublicV6(address);
  return false;
}

export type HostCheck = { ok: true; addresses: string[] } | { ok: false; reason: "unresolvable" | "private" };

/**
 * Resolve a hostname before the server fetches from it and refuse anything that lands on a
 * private, loopback, link-local, or otherwise non-public address. A literal IP is checked
 * directly. Resolution happens once per fetch; a record that changes between this check and
 * the connection (DNS rebinding) is outside what this guard can see.
 */
export async function assertPublicHost(hostname: string, lookup: LookupLike = systemLookup): Promise<HostCheck> {
  if (isIP(hostname)) {
    return isPublicAddress(hostname) ? { ok: true, addresses: [hostname] } : { ok: false, reason: "private" };
  }
  let addresses: string[];
  try {
    addresses = await lookup(hostname);
  } catch {
    return { ok: false, reason: "unresolvable" };
  }
  if (addresses.length === 0) return { ok: false, reason: "unresolvable" };
  if (!addresses.every(isPublicAddress)) return { ok: false, reason: "private" };
  return { ok: true, addresses };
}
