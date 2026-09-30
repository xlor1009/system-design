import fs from "node:fs";
import { z } from "zod";
import type { GradeResult, RubricV1 } from "@/lib/types";
import { rubricPath } from "@/lib/paths";

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
  transcriptText: string;
  diagramCaption: string;
}): Promise<GradeResult> {
  const rubric = loadRubric();
  const apiKey = process.env.LLM_API_KEY ?? "";
  if (!apiKey) return failClosed("LLM_API_KEY not set", rubric);

  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  const system = `You are a strict system-design interviewer. Grade using rubric_v1 only.
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

  const user = `Problem: ${input.problemTitle}

Prompt:
${input.promptMd}

Diagram caption:
${input.diagramCaption}

Transcript:
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
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
