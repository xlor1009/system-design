import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LLM_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "LLM_API_KEY not set" }, { status: 503 });
  }

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.TTS_MODEL ?? "tts-1-hd";
  const voice = process.env.TTS_VOICE ?? "coral";

  const res = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: `TTS HTTP ${res.status}: ${errText.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
