export function uniqueDomain(): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${stamp}.example.com`;
}
