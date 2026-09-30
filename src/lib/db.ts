import Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { Attempt, GradeResult, Problem, RoadmapItem, Session, User } from "@/lib/types";
import { dbPath, ensureDir, dataDir } from "@/lib/paths";
import { seedIfEmpty } from "@/lib/seed";

let _db: Database.Database | null = null;

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL UNIQUE,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      prompt_md TEXT NOT NULL,
      timebox_minutes INTEGER NOT NULL,
      rubric_version TEXT NOT NULL,
      admin_outline_md TEXT,
      week_of TEXT NOT NULL,
      due_at TEXT NOT NULL,
      source_url TEXT,
      source_roadmap_topic TEXT,
      notified_at TEXT,
      discord_message_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      diagram_path TEXT,
      audio_path TEXT,
      transcript_text TEXT,
      diagram_caption TEXT,
      grade_json TEXT,
      graded_at TEXT,
      grade_override_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(problem_id, user_id),
      FOREIGN KEY(problem_id) REFERENCES problems(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS roadmap_items (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      order_index INTEGER NOT NULL UNIQUE,
      notes_md TEXT,
      source_url TEXT
    );

    CREATE TABLE IF NOT EXISTS curated_queue (
      problem_id TEXT PRIMARY KEY,
      order_index INTEGER NOT NULL UNIQUE,
      week_of TEXT NOT NULL,
      FOREIGN KEY(problem_id) REFERENCES problems(id)
    );

    CREATE TABLE IF NOT EXISTS roadmap_cursor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_order_index INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDir(dataDir());
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedIfEmpty(db);
  _db = db;
  return db;
}

function mapUser(row: { id: string; display_name: string; email: string | null }): User {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email ?? undefined,
  };
}

function mapProblem(row: Record<string, unknown>): Problem {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    promptMd: row.prompt_md as string,
    timeboxMinutes: row.timebox_minutes as number,
    rubricVersion: row.rubric_version as string,
    adminOutlineMd: (row.admin_outline_md as string | null) ?? undefined,
    weekOf: row.week_of as string,
    dueAt: row.due_at as string,
    sourceUrl: (row.source_url as string | null) ?? undefined,
    sourceRoadmapTopic: (row.source_roadmap_topic as string | null) ?? undefined,
    notifiedAt: (row.notified_at as string | null) ?? undefined,
    discordMessageId: (row.discord_message_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function parseGrade(raw: string | null): GradeResult | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as GradeResult;
  } catch {
    return undefined;
  }
}

function mapAttempt(row: Record<string, unknown>): Attempt {
  return {
    id: row.id as string,
    problemId: row.problem_id as string,
    userId: row.user_id as string,
    diagramPath: (row.diagram_path as string | null) ?? undefined,
    audioPath: (row.audio_path as string | null) ?? undefined,
    transcriptText: (row.transcript_text as string | null) ?? undefined,
    diagramCaption: (row.diagram_caption as string | null) ?? undefined,
    gradeJson: parseGrade(row.grade_json as string | null),
    gradedAt: (row.graded_at as string | null) ?? undefined,
    gradeOverrideJson: parseGrade(row.grade_override_json as string | null),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findOrCreateUser(displayName: string): User {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, display_name, email FROM users WHERE display_name = ?")
    .get(displayName) as { id: string; display_name: string; email: string | null } | undefined;
  if (existing) return mapUser(existing);

  const user: User = { id: uuid(), displayName };
  db.prepare("INSERT INTO users (id, display_name, email) VALUES (?, ?, NULL)").run(
    user.id,
    user.displayName,
  );
  return user;
}

export function getUser(id: string): User | null {
  const row = getDb()
    .prepare("SELECT id, display_name, email FROM users WHERE id = ?")
    .get(id) as { id: string; display_name: string; email: string | null } | undefined;
  return row ? mapUser(row) : null;
}

export function listRoadmapItems(): RoadmapItem[] {
  const rows = getDb()
    .prepare(
      "SELECT id, topic, order_index, notes_md, source_url FROM roadmap_items ORDER BY order_index ASC",
    )
    .all() as Array<{
    id: string;
    topic: string;
    order_index: number;
    notes_md: string | null;
    source_url: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    orderIndex: r.order_index,
    notesMd: r.notes_md ?? undefined,
    sourceUrl: r.source_url ?? undefined,
  }));
}

export function getProblemBySlug(slug: string): Problem | null {
  const row = getDb().prepare("SELECT * FROM problems WHERE slug = ?").get(slug) as
    | Record<string, unknown>
    | undefined;
  return row ? mapProblem(row) : null;
}

export function getProblemById(id: string): Problem | null {
  const row = getDb().prepare("SELECT * FROM problems WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapProblem(row) : null;
}

export function listProblems(): Problem[] {
  const rows = getDb()
    .prepare("SELECT * FROM problems ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(mapProblem);
}

export function createProblem(input: {
  slug: string;
  title: string;
  promptMd: string;
  timeboxMinutes: number;
  weekOf: string;
  dueAt: string;
  adminOutlineMd?: string;
  sourceUrl?: string;
  sourceRoadmapTopic?: string;
}): Problem {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO problems (
      id, slug, title, prompt_md, timebox_minutes, rubric_version,
      admin_outline_md, week_of, due_at, source_url, source_roadmap_topic,
      notified_at, discord_message_id, created_at
    ) VALUES (?, ?, ?, ?, ?, 'rubric_v1', ?, ?, ?, ?, ?, NULL, NULL, ?)`,
  ).run(
    id,
    input.slug,
    input.title,
    input.promptMd,
    input.timeboxMinutes,
    input.adminOutlineMd ?? null,
    input.weekOf,
    input.dueAt,
    input.sourceUrl ?? null,
    input.sourceRoadmapTopic ?? null,
    now,
  );

  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(order_index), 0) AS m FROM curated_queue")
    .get() as { m: number };
  db.prepare(
    "INSERT INTO curated_queue (problem_id, order_index, week_of) VALUES (?, ?, ?)",
  ).run(id, maxOrder.m + 1, input.weekOf);

  return getProblemById(id)!;
}

export function getAttempt(problemId: string, userId: string): Attempt | null {
  const row = getDb()
    .prepare("SELECT * FROM attempts WHERE problem_id = ? AND user_id = ?")
    .get(problemId, userId) as Record<string, unknown> | undefined;
  return row ? mapAttempt(row) : null;
}

export function upsertAttempt(input: {
  problemId: string;
  userId: string;
  diagramPath?: string;
  audioPath?: string;
  transcriptText: string;
  diagramCaption: string;
  gradeJson: GradeResult;
}): Attempt {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getAttempt(input.problemId, input.userId);

  if (existing) {
    db.prepare(
      `UPDATE attempts SET
        diagram_path = COALESCE(?, diagram_path),
        audio_path = COALESCE(?, audio_path),
        transcript_text = ?,
        diagram_caption = ?,
        grade_json = ?,
        graded_at = ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      input.diagramPath ?? null,
      input.audioPath ?? null,
      input.transcriptText,
      input.diagramCaption,
      JSON.stringify(input.gradeJson),
      now,
      now,
      existing.id,
    );
    return getAttempt(input.problemId, input.userId)!;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO attempts (
      id, problem_id, user_id, diagram_path, audio_path, transcript_text,
      diagram_caption, grade_json, graded_at, grade_override_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    id,
    input.problemId,
    input.userId,
    input.diagramPath ?? null,
    input.audioPath ?? null,
    input.transcriptText,
    input.diagramCaption,
    JSON.stringify(input.gradeJson),
    now,
    now,
    now,
  );
  return getAttempt(input.problemId, input.userId)!;
}

/** Next unpublished problem by curated queue order. Idempotent via notified_at. */
export function claimNextUnpublishedProblem(): Problem | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.* FROM problems p
       JOIN curated_queue q ON q.problem_id = p.id
       WHERE p.notified_at IS NULL
       ORDER BY q.order_index ASC
       LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;
  if (!row) return null;

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE problems SET notified_at = ?
       WHERE id = ? AND notified_at IS NULL`,
    )
    .run(now, row.id as string);

  if (result.changes === 0) return null;
  return getProblemById(row.id as string);
}

export function setDiscordMessageId(problemId: string, messageId: string): void {
  getDb()
    .prepare("UPDATE problems SET discord_message_id = ? WHERE id = ?")
    .run(messageId, problemId);
}

export function sessionFromUser(user: User): Session {
  return { userId: user.id, displayName: user.displayName };
}
