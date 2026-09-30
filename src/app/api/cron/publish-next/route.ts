import { NextRequest, NextResponse } from "next/server";
import { publishNext } from "@/lib/publish";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const provided = bearer || headerSecret;

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await publishNext();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
