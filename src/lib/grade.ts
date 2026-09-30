import fs from "node:fs";
import { z } from "zod";
import type { AttemptStyle, GradeResult, RubricV1 } from "@/lib/types";
import { rubricPath } from "@/lib/paths";
import {
  INTERVIEW_OUTLINE_VERSION,
  formatPhaseRubricSheet,
  type InterviewOutlinePayload,
} from "@/lib/interview-shared";
import { diagramToDataUrl, userContentWithOptionalImage } from "@/lib/vision";

const dimensionScoreSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  feedback: z.string(),
});

const gradeSchema = z.object({
  rubricVersion: z.literal("rubric_v1"),
  overallScore: z.number().min(0),
  overallMax: z.number().positive(),
  summary: z.string().min(1),
  dimensions: z.array(dimensionScoreSchema).min(1),
});

export function loadRubric(): RubricV1 {
  const raw = JSON.parse(fs.readFileSync(rubricPath(), "utf8")) as RubricV1;
  if (raw.version !== "rubric_v1") throw new Error("Expected rubric_v1");
  return raw;
}

function failClosed(error: string, rubric: RubricV1): GradeResult {
  return {
    rubricVersion: "rubric_v1",
    overallScore: 0,
    overallMax: rubric.overallMax,
    summary: `Grading unavailable: ${error}`,
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      label: d.label,
      score: 0,
      maxScore: d.maxScore,
      feedback: "Not graded (fail closed).",
    })),
    failClosed: true,
    error,
  };
}

export async function gradeAttempt(input: {
  problemTitle: string;
  promptMd: string;
  problemSlug: string;
  transcriptText: string;
  diagramCaption: string;
  style: AttemptStyle;
  diagramUploaded: boolean;
  diagramPath?: string;
  interviewOutline?: InterviewOutlinePayload | null;
}): Promise<GradeResult> {
  const rubric = loadRubric();
  const apiKey = process.env.LLM_API_KEY ?? "";
  if (!apiKey) return failClosed("LLM_API_KEY not set", rubric);

  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  const outline = input.interviewOutline;
  const outlineLocked =
    outline &&
    outline.outlineVersion === INTERVIEW_OUTLINE_VERSION &&
    outline.problemSlug === input.problemSlug;

  const imageDataUrl = input.diagramUploaded
    ? diagramToDataUrl(input.diagramPath ?? null)
    : null;
  const hasVision = Boolean(imageDataUrl);

  const styleNotes =
    input.style === "interview"
      ? `Attempt style: STRUCTURED live interview (outline ${INTERVIEW_OUTLINE_VERSION}).
Grade using the per-phase pass/partial/miss sheet PLUS the transcript. Do not invent other phases.
Map phase performance into rubric_v1 dimensions (same scale as diagram attempts for room fairness).
${hasVision ? "A sketch-board / diagram IMAGE is attached — LOOK at it and grade architecture from what you see plus the talk track." : "No sketch image attached — grade from transcript only; do not invent a missing diagram penalty beyond what the talk implies."}
Problem slug locked for review: ${input.problemSlug}.
Outline present & locked: ${outlineLocked ? "YES" : "NO — grade from transcript only, still use phase ladder mentally"}.`
      : `Attempt style: diagram + walkthrough.
Diagram file uploaded: ${input.diagramUploaded}.
${hasVision ? "The diagram IMAGE is attached — you CAN see it. Use the image as primary evidence; the caption is supplementary." : "Image could not be attached (unsupported type or missing). Use the caption as the stand-in; do not claim the file was never uploaded if diagramUploaded is true."}
NEVER invent a "diagram not sent" failure when diagramUploaded is true.`;

  const system = `You are a strict system-design interviewer. Grade using rubric_v1 only.
Both attempt styles share the SAME rubric and score scale so room rankings stay fair.
${styleNotes}

Return JSON matching this schema exactly:
{
  "rubricVersion": "rubric_v1",
  "overallScore": number,
  "overallMax": ${rubric.overallMax},
  "summary": string,
  "dimensions": [{ "id", "label", "score", "maxScore", "feedback" }]
}
Use these dimensions: ${JSON.stringify(rubric.dimensions)}
Scores must be integers within each dimension max. overallScore is the sum of dimension scores.`;

  const phaseSheet =
    outlineLocked && outline
      ? `Phase rubric sheet (pass / partial / miss):
${formatPhaseRubricSheet(outline)}
Deep-dive topics: ${outline.deepDiveTopics.join(", ") || "(none)"}`
      : "";

  const userText =
    input.style === "interview"
      ? `Problem: ${input.problemTitle}
Slug: ${input.problemSlug}

Prompt:
${input.promptMd}

${phaseSheet}

Interview conversation transcript:
${input.transcriptText}

Notes:
${input.diagramCaption || "(none)"}
${hasVision ? "\n(See attached sketch board / diagram image.)" : ""}`
      : `Problem: ${input.problemTitle}

Prompt:
${input.promptMd}

Diagram uploaded: ${input.diagramUploaded ? "YES" : "NO"}${hasVision ? " (image attached)" : ""}

Diagram caption:
${input.diagramCaption}

Walkthrough transcript:
${input.transcriptText}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: userContentWithOptionalImage(userText, imageDataUrl),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return failClosed(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`, rubric);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return failClosed("Empty LLM response", rubric);

    const parsed = gradeSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return failClosed(`Invalid grade JSON: ${parsed.error.message}`, rubric);
    }

    const grade = parsed.data;
    const dimIds = new Set(rubric.dimensions.map((d) => d.id));
    if (grade.dimensions.some((d) => !dimIds.has(d.id))) {
      return failClosed("Grade dimensions mismatch rubric", rubric);
    }

    return grade;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failClosed(msg, rubric);
  }
}
