/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * Failure memory. Map cold areas. Do not prescribe success.
 */

import { FORBIDDEN_CONTENT_KEYS, PACK_DOM_MUTATIONS } from "@/lib/hard-nos";
import type { HuskGeometry } from "./topology";

export type SlopEntry = {
  zone: "cold";
  errorType: string;
  badPattern: string;
  avoid: string;
  file: string | null;
  shatter: number | null;
};

export type SlopCanon = {
  proprietary: true;
  domain: "signal-husk";
  principle: string;
  cold: SlopEntry[];
};

const HARD_NO_SLOP: Array<Pick<SlopEntry, "errorType" | "badPattern" | "avoid">> = [
  {
    errorType: "dom-mutation",
    badPattern: PACK_DOM_MUTATIONS.join(" | "),
    avoid: "Do not write the client DOM from the pack. Observe only.",
  },
  {
    errorType: "page-content-inference",
    badPattern: FORBIDDEN_CONTENT_KEYS.slice(0, 8).join(" | "),
    avoid: "Do not ingest raw page HTML or body text for a model.",
  },
  {
    errorType: "invented-lift",
    badPattern: "lift | sites like yours | peer average | benchmark",
    avoid: "Do not invent cross-tenant lift or peer-benchmark claims.",
  },
  {
    errorType: "global-listing",
    badPattern: "GET /api/sites list",
    avoid: "Do not list sites without a token scope.",
  },
];

export function buildSlopCanon(geometry: HuskGeometry): SlopCanon {
  const cold: SlopEntry[] = HARD_NO_SLOP.map((entry) => ({
    ...entry,
    zone: "cold" as const,
    file: null,
    shatter: null,
  }));

  for (const file of geometry.files.filter((item) => item.zone === "cold" || item.kind === "shattered")) {
    cold.push({
      zone: "cold",
      errorType: "geometric-isolate",
      badPattern: file.file,
      avoid: `Cold region. Do not treat ${file.file} as canonical. Re-anchor or inspect; do not copy it.`,
      file: file.file,
      shatter: file.shatter,
    });
  }

  return {
    proprietary: true,
    domain: "signal-husk",
    principle: "Map failure and stay out of cold regions. Do not prescribe success.",
    cold,
  };
}
