import { NextResponse } from "next/server";

export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL);
  return NextResponse.json({
    ok: true,
    service: "signal",
    version: "0.1.0",
    databaseConfigured: hasDb,
  });
}
