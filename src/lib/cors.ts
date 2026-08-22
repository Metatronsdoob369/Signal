export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function requestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;
  return process.env.APP_ORIGIN || "*";
}
