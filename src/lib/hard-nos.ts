/** v0.1 hard nos — enforced in code, not comments. */

export const MAX_BEACON_BYTES = 32_768;
export const MAX_REGISTER_BYTES = 4_096;
export const MAX_TOKEN_LENGTH = 128;

export const BEACON_RATE = { windowMs: 60_000, max: 30 } as const;
export const REGISTER_RATE = { windowMs: 60 * 60 * 1000, max: 10 } as const;
/** Every registration triggers an outbound robots.txt read, so the total is capped too. */
export const REGISTER_GLOBAL_RATE = { windowMs: 60 * 60 * 1000, max: 60 } as const;

export const FORBIDDEN_CONTENT_KEYS = [
  "html",
  "innerhtml",
  "outerhtml",
  "innertext",
  "body",
  "bodytext",
  "bodyhtml",
  "pagecontent",
  "rawhtml",
  "document",
  "source",
  "markdown",
  "pagehtml",
  "fulltext",
  "contenthtml",
  "textcontent",
  "articlebody",
] as const;

export const PACK_DOM_MUTATIONS = [
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "document.write",
  "document.writeln",
] as const;

export const MIN_TITLE_LENGTH = 30;
export const MAX_TITLE_LENGTH = 60;
export const MIN_DESCRIPTION_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 160;
export const MIN_EXPERIMENT_IMPRESSIONS = 30;
export const PROMOTE_RATE_RATIO = 1.15;
export const MAX_ACTIVE_VARIANTS = 5;
export const ENGAGE_SUCCESS_THRESHOLD = 0.5;
