import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAttempt, getProblemBySlug, upsertAttempt } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { gradeAttempt } from "@/lib/grade";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  const transcriptText = String(form.get("transcript") ?? "").trim();
  const diagramCaption = String(form.get("caption") ?? "").trim();
  const diagram = form.get("diagram");
  const audio = form.get("audio");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!transcriptText) {
    return NextResponse.json({ error: "Transcript required" }, { status: 400 });
  }
  if (!diagramCaption) {
    return NextResponse.json({ error: "Diagram caption required" }, { status: 400 });
  }
  const problem = getProblemBySlug(slug);
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const existing = getAttempt(problem.id, session.userId);

  const hasDiagram = diagram instanceof File && diagram.size > 0;
  const hasAudio = audio instanceof File && audio.size > 0;
  if (!hasDiagram && !existing?.diagramPath) {
    return NextResponse.json({ error: "Diagram file required" }, { status: 400 });
  }
  if (!hasAudio && !existing?.audioPath) {
    return NextResponse.json({ error: "Audio recording required" }, { status: 400 });
  }

  const diagramPath = hasDiagram
    ? await saveUpload(problem.id, session.userId, "diagram", diagram as File)
    : existing?.diagramPath;
  const audioPath = hasAudio
    ? await saveUpload(problem.id, session.userId, "audio", audio as File)
    : existing?.audioPath;

  const gradeJson = await gradeAttempt({
    problemTitle: problem.title,
    promptMd: problem.promptMd,
    transcriptText,
    diagramCaption,
  });

  const attempt = upsertAttempt({
    problemId: problem.id,
    userId: session.userId,
    diagramPath,
    audioPath,
    transcriptText,
    diagramCaption,
    gradeJson,
  });

  return NextResponse.json({ ok: true, attempt });
}
