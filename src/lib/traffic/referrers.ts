export type SourceClass = "ai" | "search" | "social" | "direct" | "other";

export type KnownReferrer = {
  hostSuffix: string;
  source: Exclude<SourceClass, "direct" | "other">;
  note?: string;
};

/** Review this table quarterly, same cadence as KNOWN_BOTS. */
export const REFERRERS_AS_OF = "2026-09-11";

// Host suffixes (match end of hostname, case-insensitive, without leading www)
export const KNOWN_REFERRERS: readonly KnownReferrer[] = [
  // AI answer engines
  { hostSuffix: "perplexity.ai", source: "ai", note: "Perplexity" },
  { hostSuffix: "chat.openai.com", source: "ai", note: "ChatGPT" },
  { hostSuffix: "claude.ai", source: "ai", note: "Claude" },
  { hostSuffix: "poe.com", source: "ai", note: "Poe" },
  { hostSuffix: "you.com", source: "ai", note: "You.com" },
  { hostSuffix: "copilot.microsoft.com", source: "ai", note: "Copilot" },
  { hostSuffix: "gemini.google.com", source: "ai", note: "Gemini" },
  { hostSuffix: "meta.ai", source: "ai", note: "Meta AI" },

  // Search
  { hostSuffix: "google.com", source: "search", note: "Google" },
  { hostSuffix: ".google.", source: "search", note: "Google country TLDs" }, // matches google.co.uk etc
  { hostSuffix: "bing.com", source: "search", note: "Bing" },
  { hostSuffix: "duckduckgo.com", source: "search", note: "DuckDuckGo" },
  { hostSuffix: "search.brave.com", source: "search", note: "Brave Search" },
  { hostSuffix: "yahoo.com", source: "search", note: "Yahoo" },
  { hostSuffix: "yandex.ru", source: "search", note: "Yandex" },

  // Social
  { hostSuffix: "twitter.com", source: "social", note: "Twitter" },
  { hostSuffix: "x.com", source: "social", note: "X" },
  { hostSuffix: "t.co", source: "social", note: "Twitter shortener" },
  { hostSuffix: "facebook.com", source: "social", note: "Facebook" },
  { hostSuffix: "instagram.com", source: "social", note: "Instagram" },
  { hostSuffix: "linkedin.com", source: "social", note: "LinkedIn" },
  { hostSuffix: "reddit.com", source: "social", note: "Reddit" },
  { hostSuffix: "tiktok.com", source: "social", note: "TikTok" },
  { hostSuffix: "youtube.com", source: "social", note: "YouTube" },
  { hostSuffix: "pinterest.com", source: "social", note: "Pinterest" },
];

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export function classifyReferrerHost(host: string): SourceClass {
  const h = normalizeHost(host);
  if (!h) return "direct";
  for (const known of KNOWN_REFERRERS) {
    if (known.hostSuffix.startsWith(".")) {
      // country TLD catch-all like ".google."
      if (h.includes(known.hostSuffix)) return known.source;
    } else if (h === known.hostSuffix || h.endsWith(`.${known.hostSuffix}`)) {
      return known.source;
    }
  }
  return "other";
}

