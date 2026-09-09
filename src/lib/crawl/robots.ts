import type { CrawlAccess } from "@/contracts";

export type RobotsRule = { type: "allow" | "disallow"; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };
export type ParsedRobots = { groups: RobotsGroup[]; sitemaps: string[] };

/**
 * Minimal RFC 9309 parser: groups of user-agent lines followed by allow/disallow rules.
 * Unknown directives are ignored. Comments (#) are stripped.
 */
export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (field === "allow" || field === "disallow") {
      if (!current) continue;
      current.rules.push({ type: field, path: value });
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function selectGroup(parsed: ParsedRobots, token: string): RobotsGroup | null {
  const needle = token.toLowerCase();
  let best: { group: RobotsGroup; length: number } | null = null;
  for (const group of parsed.groups) {
    for (const agent of group.agents) {
      if (agent === "*" || !agent) continue;
      if (needle === agent || needle.includes(agent) || agent.includes(needle)) {
        if (!best || agent.length > best.length) best = { group, length: agent.length };
      }
    }
  }
  if (best) return best.group;
  for (const group of parsed.groups) {
    if (group.agents.includes("*")) return group;
  }
  return null;
}

function patternToRegex(pattern: string): RegExp {
  let anchored = false;
  let body = pattern;
  if (body.endsWith("$")) {
    anchored = true;
    body = body.slice(0, -1);
  }
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Resolve the policy a token gets for the site root ("/"). */
export function rootAccessFor(parsed: ParsedRobots, token: string): CrawlAccess {
  const group = selectGroup(parsed, token);
  if (!group) return "unspecified";
  let winner: { rule: RobotsRule; length: number } | null = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (!patternToRegex(rule.path).test("/")) continue;
    const length = rule.path.length;
    if (!winner || length > winner.length || (length === winner.length && rule.type === "allow")) {
      winner = { rule, length };
    }
  }
  if (!winner) return "allow";
  return winner.rule.type === "disallow" ? "disallow" : "allow";
}

export type RobotsEvaluation = {
  bots: Record<string, CrawlAccess>;
  sitemapDeclared: boolean;
  disallowAll: boolean;
};

export function evaluateRobots(text: string, tokens: readonly string[]): RobotsEvaluation {
  const parsed = parseRobotsTxt(text);
  const bots: Record<string, CrawlAccess> = {};
  for (const token of tokens) bots[token] = rootAccessFor(parsed, token);
  const wildcard = parsed.groups.find((group) => group.agents.includes("*"));
  const disallowAll = wildcard ? rootAccessFor({ groups: [wildcard], sitemaps: [] }, "*") === "disallow" : false;
  return { bots, sitemapDeclared: parsed.sitemaps.length > 0, disallowAll };
}
