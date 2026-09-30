import fs from "node:fs";
import path from "node:path";
import { resolveUpload } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** OpenAI-style multimodal content parts. */
export type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function diagramToDataUrl(relPath: string | undefined | null): string | null {
  if (!relPath) return null;
  const abs = resolveUpload(relPath);
  if (!abs) return null;
  const ext = path.extname(abs).toLowerCase();
  // Skip non-images (e.g. PDF) for vision
  const mime = MIME[ext];
  if (!mime) return null;
  const buf = fs.readFileSync(abs);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function normalizeBoardDataUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("data:image/")) return null;
  // Cap ~4MB base64 payload
  if (trimmed.length > 5_500_000) return null;
  return trimmed;
}

export function userContentWithOptionalImage(
  text: string,
  dataUrl: string | null,
): string | VisionContentPart[] {
  if (!dataUrl) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
}
