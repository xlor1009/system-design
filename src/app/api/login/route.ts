import { NextRequest, NextResponse } from "next/server";
import { loginResponse } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1),
  displayName: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  return loginResponse(parsed.data.password, parsed.data.displayName);
}
