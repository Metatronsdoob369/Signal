import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PACK_DOM_MUTATIONS } from "@/lib/hard-nos";
import { buildPackScript } from "@/lib/pack-script";

describe("buildPackScript", () => {
  it("does not use forbidden DOM mutation APIs", () => {
    const script = buildPackScript({ token: "test-token", origin: "http://localhost:3000" });
    for (const needle of PACK_DOM_MUTATIONS) {
      expect(script).not.toContain(needle);
    }
  });

  it("may set title and meta description after resolve, but not findings", () => {
    const script = buildPackScript({ token: "test-token", origin: "http://localhost:3000" });
    expect(script).toContain("/api/resolve");
    expect(script).toContain("document.title");
    expect(script).toContain('meta[name="description"]');
    expect(script).toContain('intent: "experiment"');
    expect(script).not.toContain("findings");
    expect(script).not.toContain("innerHTML");
  });

  it("sends structured signals, not page HTML", () => {
    const script = buildPackScript({ token: "test-token", origin: "http://localhost:3000" });
    expect(script).not.toContain("innerHTML");
    expect(script).not.toContain("outerHTML");
    expect(script).toContain("wordCount");
    expect(script).toContain("/api/beacon");
  });
});

describe("hard-no source locks", () => {
  it("dashboard copy does not invent lift or peer benchmarks", () => {
    const src = readFileSync(resolve("src/app/dashboard/[token]/page.tsx"), "utf8");
    expect(src).toContain("Experiments");
    expect(src).not.toMatch(/lift|sites like yours|peer average|benchmark/i);
  });

  it("keeps .env files out of git", () => {
    const gitignore = readFileSync(resolve(".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*/m);
  });

  it("does not depend on a cloud inference SDK", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.some((name) => /openai|anthropic|@xai|ai-sdk|@ai-sdk/.test(name))).toBe(false);
  });

  it("keeps generated terrain artifacts out of git", () => {
    const gitignore = readFileSync(resolve(".gitignore"), "utf8");
    expect(gitignore).toMatch(/\/terrain\/\*\.json/);
  });

  it("product runtime does not import the terrain husk", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const next = join(dir, name);
        if (statSync(next).isDirectory()) {
          if (name === "terrain") continue;
          walk(next);
          continue;
        }
        if (next.endsWith(".ts") || next.endsWith(".tsx")) files.push(next);
      }
    };
    walk("src");
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/from ["']@\/terrain/);
    }
  });

  it("home is Signal, not Cosine+", () => {
    const src = readFileSync(resolve("src/app/page.tsx"), "utf8");
    expect(src).toContain("Signal");
    expect(src).not.toMatch(/Cosine\+/);
  });

  it("does not ship a DOM-mutating ingest embed", () => {
    expect(existsSync(resolve("public/embed.js"))).toBe(false);
    expect(existsSync(resolve("src/app/api/ingest/route.ts"))).toBe(false);
  });
});
