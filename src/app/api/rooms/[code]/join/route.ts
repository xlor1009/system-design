import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureRoomMember, getRoomByInviteCode } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await ctx.params;
  const room = getRoomByInviteCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  ensureRoomMember(room.id, session.userId);
  return NextResponse.json({ ok: true, room, invitePath: `/rooms/${room.inviteCode}` });
}
