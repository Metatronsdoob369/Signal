/**
 * Origin + pathname for a URL string. Strips query and hash; null when invalid.
 */
export function originAndPathname(input: string): string | null {
  try {
    const u = new URL(input);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

