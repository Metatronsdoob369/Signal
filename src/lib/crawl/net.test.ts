import { describe, expect, it } from "vitest";
import { assertPublicHost, isPublicAddress } from "@/lib/crawl/net";

describe("isPublicAddress", () => {
  it("accepts public v4 and v6", () => {
    for (const address of ["93.184.216.34", "185.199.108.153", "8.8.8.8", "2606:4700::6810:84e5", "2a00:1450:4001:800::200e"]) {
      expect(isPublicAddress(address)).toBe(true);
    }
  });

  it("refuses private, loopback, link-local, CGNAT, documentation, and multicast v4", () => {
    for (const address of [
      "0.0.0.0", "10.0.0.1", "100.64.0.1", "100.127.255.254", "127.0.0.1", "169.254.169.254",
      "172.16.0.1", "172.31.255.255", "192.0.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1",
      "198.51.100.7", "203.0.113.9", "224.0.0.1", "255.255.255.255",
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
    expect(isPublicAddress("172.32.0.1")).toBe(true);
    expect(isPublicAddress("100.128.0.1")).toBe(true);
  });

  it("refuses unspecified, loopback, ULA, link-local, multicast, documentation, and mapped-private v6", () => {
    for (const address of [
      "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%en0", "ff02::1", "2001:db8::1",
      "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::10.0.0.1", "2002:0a00:0001::", "64:ff9b::a00:1",
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
    expect(isPublicAddress("::ffff:93.184.216.34")).toBe(true);
    expect(isPublicAddress("2002:5db8:d822::")).toBe(true);
  });

  it("treats anything unparseable as not public", () => {
    for (const address of ["", "example.com", "300.1.1.1", "1.2.3", "::ffff:1.2.3", "gggg::1", "1:2:3:4:5:6:7:8:9"]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });
});

describe("assertPublicHost", () => {
  it("checks literal addresses without resolving", async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return ["93.184.216.34"];
    };
    expect((await assertPublicHost("127.0.0.1", lookup)).ok).toBe(false);
    expect((await assertPublicHost("93.184.216.34", lookup)).ok).toBe(true);
    expect(called).toBe(false);
  });

  it("refuses when any resolved address is non-public", async () => {
    const mixed = await assertPublicHost("rebind.example.com", async () => ["93.184.216.34", "10.0.0.1"]);
    expect(mixed).toEqual({ ok: false, reason: "private" });
    const clean = await assertPublicHost("example.com", async () => ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
    expect(clean.ok).toBe(true);
  });

  it("reports unresolvable hosts", async () => {
    expect(await assertPublicHost("x.example.com", async () => [])).toEqual({ ok: false, reason: "unresolvable" });
    expect(
      await assertPublicHost("x.example.com", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).toEqual({ ok: false, reason: "unresolvable" });
  });
});
