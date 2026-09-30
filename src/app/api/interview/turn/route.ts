import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProblemBySlug } from "@/lib/db";
import { nextInterviewerTurn } from "@/lib/interview";
import {
  INTERVIEW_OUTLINE_VERSION,
  type InterviewMessage,
  type InterviewSessionState,
} from "@/lib/interview-shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessionUser = await getSession();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    slug?: string;
    messages?: InterviewMessage[];
    session?: InterviewSessionState | null;
    stuck?: boolean;
    boardImageDataUrl?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const problem = getProblemBySlug(slug);
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  if (
    body.session &&
    body.session.outlineVersion === INTERVIEW_OUTLINE_VERSION &&
    body.session.problemSlug &&
    body.session.problemSlug !== slug
  ) {
    return NextResponse.json(
      { error: "Interview session is locked to a different problem URL" },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  for (const m of messages) {
    if (
      !m ||
      (m.role !== "interviewer" && m.role !== "candidate") ||
      typeof m.content !== "string"
    ) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }
  }

  try {
    const turn = await nextInterviewerTurn({
      problem,
      messages,
      session: body.session,
      stuck: Boolean(body.stuck),
      boardImageDataUrl: body.boardImageDataUrl,
    });
    return NextResponse.json({
      ok: true,
      reply: turn.reply,
      session: turn.session,
      suggestEnd: turn.suggestEnd,
      outlineVersion: INTERVIEW_OUTLINE_VERSION,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Interview turn failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
