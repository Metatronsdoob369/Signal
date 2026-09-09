/**
 * User-agent tokens that matter for AI visibility, split by what they do.
 *
 * fetcher — retrieves a page at answer time on a user's behalf. Blocking it removes the
 *           page from live AI answers.
 * search  — builds the index an AI answer engine retrieves from. Blocking it removes the
 *           page from that engine's citations.
 * trainer — collects data for model training. Blocking it is a legitimate policy choice
 *           and does not affect retrieval-time visibility, so it is reported, never scored.
 *
 * Tokens and roles are vendor-documented as of BOTS_AS_OF. Review quarterly.
 */
export type BotRole = "fetcher" | "search" | "trainer";

export type KnownBot = {
  token: string;
  vendor: string;
  role: BotRole;
  note: string;
};

export const BOTS_AS_OF = "2026-09-09";

export const KNOWN_BOTS: readonly KnownBot[] = [
  { token: "OAI-SearchBot", vendor: "OpenAI", role: "search", note: "ChatGPT search index" },
  { token: "ChatGPT-User", vendor: "OpenAI", role: "fetcher", note: "ChatGPT user-triggered fetch" },
  { token: "GPTBot", vendor: "OpenAI", role: "trainer", note: "Model training crawl" },
  { token: "Claude-SearchBot", vendor: "Anthropic", role: "search", note: "Claude search index" },
  { token: "Claude-User", vendor: "Anthropic", role: "fetcher", note: "Claude user-triggered fetch" },
  { token: "ClaudeBot", vendor: "Anthropic", role: "trainer", note: "Model training crawl" },
  { token: "PerplexityBot", vendor: "Perplexity", role: "search", note: "Perplexity index" },
  { token: "Perplexity-User", vendor: "Perplexity", role: "fetcher", note: "Perplexity user-triggered fetch" },
  { token: "Googlebot", vendor: "Google", role: "search", note: "Search, AI Overviews, AI Mode" },
  { token: "Google-Extended", vendor: "Google", role: "trainer", note: "Gemini training opt-out control" },
  { token: "Bingbot", vendor: "Microsoft", role: "search", note: "Bing and Copilot" },
  { token: "Applebot", vendor: "Apple", role: "search", note: "Siri, Spotlight, Apple search" },
  { token: "Applebot-Extended", vendor: "Apple", role: "trainer", note: "Apple training opt-out control" },
  { token: "DuckAssistBot", vendor: "DuckDuckGo", role: "fetcher", note: "DuckAssist answers" },
  { token: "Amazonbot", vendor: "Amazon", role: "search", note: "Alexa answers" },
  { token: "meta-externalfetcher", vendor: "Meta", role: "fetcher", note: "Meta AI user-triggered fetch" },
  { token: "meta-externalagent", vendor: "Meta", role: "trainer", note: "Model training crawl" },
  { token: "CCBot", vendor: "Common Crawl", role: "trainer", note: "Open crawl corpus used for training" },
  { token: "Bytespider", vendor: "ByteDance", role: "trainer", note: "Model training crawl" },
];

export const RETRIEVAL_ROLES: ReadonlySet<BotRole> = new Set<BotRole>(["fetcher", "search"]);

export function retrievalBots(): KnownBot[] {
  return KNOWN_BOTS.filter((bot) => RETRIEVAL_ROLES.has(bot.role));
}

export function trainingBots(): KnownBot[] {
  return KNOWN_BOTS.filter((bot) => bot.role === "trainer");
}
