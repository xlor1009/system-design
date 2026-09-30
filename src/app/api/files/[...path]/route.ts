import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveUpload } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".webm": "audio/webm",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  const abs = resolveUpload(rel);
  if (!abs) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Private grades/files: only owner path segment (userId) may read
  const userIdInPath = parts[1];
  if (userIdInPath !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
