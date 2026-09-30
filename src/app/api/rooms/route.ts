import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createRoom } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "Room name required (max 80 chars)" }, { status: 400 });
  }

  try {
    const room = createRoom(name, session.userId);
    return NextResponse.json({
      ok: true,
      room,
      invitePath: `/rooms/${room.inviteCode}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
