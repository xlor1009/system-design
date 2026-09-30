import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createProblem } from "@/lib/db";

const schema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  promptMd: z.string().min(1),
  timeboxMinutes: z.number().int().min(5).max(240),
  weekOf: z.string().min(1),
  dueAt: z.string().datetime(),
  adminOutlineMd: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourceRoadmapTopic: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const problem = createProblem(parsed.data);
    return NextResponse.json({ ok: true, problem });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
