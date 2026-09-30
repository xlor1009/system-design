import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAttempt, getProblemBySlug, upsertAttempt } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { gradeAttempt } from "@/lib/grade";
import type { AttemptStyle } from "@/lib/types";
import {
  INTERVIEW_OUTLINE_VERSION,
  type InterviewOutlinePayload,
} from "@/lib/interview-shared";

export const runtime = "nodejs";

function parseStyle(raw: FormDataEntryValue | null): AttemptStyle {
  return raw === "interview" ? "interview" : "diagram";
}

function parseOutline(
  raw: FormDataEntryValue | null,
  slug: string,
): InterviewOutlinePayload | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as InterviewOutlinePayload;
    if (parsed.outlineVersion !== INTERVIEW_OUTLINE_VERSION) return null;
    if (parsed.problemSlug !== slug) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  const style = parseStyle(form.get("style"));
  const transcriptText = String(form.get("transcript") ?? "").trim();
  const diagramCaption = String(form.get("caption") ?? "").trim();
  const diagram = form.get("diagram");
  const audio = form.get("audio");
  const interviewOutline = parseOutline(form.get("interviewOutline"), slug);

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!transcriptText) {
    return NextResponse.json(
      {
        error:
          style === "interview"
            ? "Interview transcript required"
            : "Transcript required",
      },
      { status: 400 },
    );
  }

  if (style === "diagram" && !diagramCaption) {
    return NextResponse.json({ error: "Diagram caption required" }, { status: 400 });
  }

  if (style === "interview" && form.get("interviewOutline") && !interviewOutline) {
    return NextResponse.json(
      { error: "Interview outline must match phase_ladder_v1 and this problem URL" },
      { status: 400 },
    );
  }

  const problem = getProblemBySlug(slug);
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const existing = getAttempt(problem.id, session.userId);

  const hasDiagram = diagram instanceof File && diagram.size > 0;
  const hasAudio = audio instanceof File && audio.size > 0;

  if (style === "diagram" && !hasDiagram && !existing?.diagramPath) {
    return NextResponse.json({ error: "Diagram file required" }, { status: 400 });
  }

  const diagramPath = hasDiagram
    ? await saveUpload(problem.id, session.userId, "diagram", diagram as File)
    : existing?.diagramPath;

  const audioPath = hasAudio
    ? await saveUpload(problem.id, session.userId, "audio", audio as File)
    : existing?.audioPath;

  const diagramUploaded = Boolean(diagramPath);

  const gradeJson = await gradeAttempt({
    problemTitle: problem.title,
    promptMd: problem.promptMd,
    problemSlug: problem.slug,
    transcriptText,
    diagramCaption,
    style,
    diagramUploaded,
    diagramPath,
    interviewOutline,
  });

  const attempt = upsertAttempt({
    problemId: problem.id,
    userId: session.userId,
    style,
    diagramPath,
    audioPath,
    transcriptText,
    diagramCaption,
    interviewJson: interviewOutline ?? undefined,
    gradeJson,
  });

  return NextResponse.json({ ok: true, attempt });
}
