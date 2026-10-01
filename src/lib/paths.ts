import fs from "node:fs";
import path from "node:path";

export function dataDir(): string {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  // Production containers (Railway) expect a writable volume at /data.
  if (process.env.NODE_ENV === "production") return "/data";
  return path.resolve(process.cwd(), ".data");
}

export function dbPath(): string {
  return path.join(dataDir(), "study-loop.db");
}

export function uploadsRoot(): string {
  return path.join(dataDir(), "uploads");
}

export function uploadDir(problemId: string, userId: string): string {
  return path.join(uploadsRoot(), problemId, userId);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function rubricPath(): string {
  return path.join(process.cwd(), "content", "rubric_v1.json");
}
