import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MIN_TITLE_LENGTH,
} from "@/lib/hard-nos";

const DESCRIPTION_PAD = " Learn more about this page and what visitors can expect.";

export function fitTitle(raw: string): string {
  let title = raw.trim().replace(/\s+/g, " ");
  if (title.length <= MAX_TITLE_LENGTH) return title;
  const clipped = title.slice(0, MAX_TITLE_LENGTH - 1).replace(/\s+\S*$/, "").trimEnd();
  title = `${clipped || title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
  return title.slice(0, MAX_TITLE_LENGTH);
}

export function fitDescription(raw: string): string {
  let description = raw.trim().replace(/\s+/g, " ");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    const clipped = description.slice(0, MAX_DESCRIPTION_LENGTH - 1).replace(/\s+\S*$/, "").trimEnd();
    return `${clipped || description.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`.slice(
      0,
      MAX_DESCRIPTION_LENGTH,
    );
  }
  while (description.length < MIN_DESCRIPTION_LENGTH) {
    description = `${description}${DESCRIPTION_PAD}`.trim();
  }
  return description.slice(0, MAX_DESCRIPTION_LENGTH);
}

export function acceptVariant(title: string, description: string): boolean {
  const t = title.trim();
  const d = description.trim();
  if (!t || !d) return false;
  if (t.length < MIN_TITLE_LENGTH || t.length > MAX_TITLE_LENGTH) return false;
  if (d.length < MIN_DESCRIPTION_LENGTH || d.length > MAX_DESCRIPTION_LENGTH) return false;
  return true;
}

export function normalizePath(path: string): string {
  const trimmed = path.trim() || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function titleCasePath(path: string): string {
  const base = path.replace(/^\//, "").replace(/[-_/]+/g, " ").trim();
  const label = base || "Home";
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function pathFromUrl(url: string): string {
  try {
    return normalizePath(new URL(url).pathname);
  } catch {
    return "/";
  }
}

export function variantKey(title: string, description: string): string {
  return `${title.toLowerCase().trim()}||${description.toLowerCase().trim()}`;
}
