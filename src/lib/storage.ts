import fs from "node:fs";
import path from "node:path";
import { ensureDir, uploadDir, uploadsRoot } from "@/lib/paths";

export async function saveUpload(
  problemId: string,
  userId: string,
  kind: "diagram" | "audio",
  file: File,
): Promise<string> {
  const dir = uploadDir(problemId, userId);
  ensureDir(dir);

  const ext =
    kind === "diagram"
      ? guessExt(file.name, file.type) || ".png"
      : ".webm";
  const filename = `${kind}${ext}`;
  const abs = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(abs, buf);

  // Relative to uploads root for URL serving
  return path.posix.join(problemId, userId, filename);
}

export function resolveUpload(relPath: string): string | null {
  const root = path.resolve(uploadsRoot());
  const abs = path.resolve(path.join(uploadsRoot(), relPath));
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

function guessExt(name: string, mime: string): string {
  const fromName = path.extname(name);
  if (fromName) return fromName.toLowerCase();
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("svg")) return ".svg";
  if (mime.includes("pdf")) return ".pdf";
  return "";
}
