import Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { Attempt, AttemptStyle, GradeResult, Problem, RoadmapItem, Room, RoomBoard, RoomMemberStatus, RoomWinner, Session, User } from "@/lib/types";
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

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY(room_id) REFERENCES rooms(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const attemptCols = db
    .prepare("PRAGMA table_info(attempts)")
    .all() as Array<{ name: string }>;
  if (!attemptCols.some((c) => c.name === "attempt_style")) {
    db.exec(
      `ALTER TABLE attempts ADD COLUMN attempt_style TEXT NOT NULL DEFAULT 'diagram'`,
    );
  }
  if (!attemptCols.some((c) => c.name === "interview_json")) {
    db.exec(`ALTER TABLE attempts ADD COLUMN interview_json TEXT`);
  }
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

function parseJsonUnknown(raw: string | null): unknown | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function mapAttempt(row: Record<string, unknown>): Attempt {
  const styleRaw = (row.attempt_style as string | null) ?? "diagram";
  const style: AttemptStyle = styleRaw === "interview" ? "interview" : "diagram";
  return {
    id: row.id as string,
    problemId: row.problem_id as string,
    userId: row.user_id as string,
    style,
    diagramPath: (row.diagram_path as string | null) ?? undefined,
    audioPath: (row.audio_path as string | null) ?? undefined,
    transcriptText: (row.transcript_text as string | null) ?? undefined,
    diagramCaption: (row.diagram_caption as string | null) ?? undefined,
    interviewJson: parseJsonUnknown(row.interview_json as string | null),
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
  style: AttemptStyle;
  diagramPath?: string;
  audioPath?: string;
  transcriptText: string;
  diagramCaption: string;
  interviewJson?: unknown;
  gradeJson: GradeResult;
}): Attempt {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getAttempt(input.problemId, input.userId);
  const interviewRaw =
    input.interviewJson === undefined ? null : JSON.stringify(input.interviewJson);

  if (existing) {
    db.prepare(
      `UPDATE attempts SET
        attempt_style = ?,
        diagram_path = COALESCE(?, diagram_path),
        audio_path = COALESCE(?, audio_path),
        transcript_text = ?,
        diagram_caption = ?,
        interview_json = COALESCE(?, interview_json),
        grade_json = ?,
        graded_at = ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      input.style,
      input.diagramPath ?? null,
      input.audioPath ?? null,
      input.transcriptText,
      input.diagramCaption,
      interviewRaw,
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
      diagram_caption, grade_json, graded_at, grade_override_json, created_at, updated_at,
      attempt_style, interview_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
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
    input.style,
    interviewRaw,
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

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    name: row.name as string,
    inviteCode: row.invite_code as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

function inviteCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function getCurrentProblem(): Problem | null {
  return listProblems()[0] ?? null;
}

export function getRoomById(id: string): Room | null {
  const row = getDb().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRoom(row) : null;
}

export function getRoomByInviteCode(code: string): Room | null {
  const row = getDb()
    .prepare("SELECT * FROM rooms WHERE invite_code = ?")
    .get(code.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? mapRoom(row) : null;
}

export function createRoom(name: string, createdBy: string): Room {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Room name required");

  let code = inviteCode();
  for (let i = 0; i < 8; i++) {
    const clash = db.prepare("SELECT 1 FROM rooms WHERE invite_code = ?").get(code);
    if (!clash) break;
    code = inviteCode();
  }

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO rooms (id, name, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, trimmed, code, createdBy, now);
  db.prepare(
    "INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)",
  ).run(id, createdBy, now);
  return getRoomById(id)!;
}

export function ensureRoomMember(roomId: string, userId: string): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(roomId, userId);
  if (existing) return;
  db.prepare(
    "INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)",
  ).run(roomId, userId, new Date().toISOString());
}

export function listRoomsForUser(userId: string): Room[] {
  const rows = getDb()
    .prepare(
      `SELECT r.* FROM rooms r
       JOIN room_members m ON m.room_id = r.id
       WHERE m.user_id = ?
       ORDER BY r.created_at DESC`,
    )
    .all(userId) as Record<string, unknown>[];
  return rows.map(mapRoom);
}

function effectiveGrade(attempt: Attempt | null): GradeResult | undefined {
  if (!attempt) return undefined;
  return attempt.gradeOverrideJson ?? attempt.gradeJson;
}

function isSubmitted(attempt: Attempt | null): boolean {
  const grade = effectiveGrade(attempt);
  return Boolean(grade && attempt?.gradedAt);
}

function buildWhy(grade: GradeResult): string {
  const dims = [...grade.dimensions].sort((a, b) => b.score - a.score).slice(0, 2);
  const lines = dims.map((d) => `${d.label}: ${d.feedback}`).filter(Boolean);
  if (lines.length === 0) return grade.summary;
  return `${grade.summary}\n\n${lines.join("\n")}`;
}

export function getRoomBoard(roomId: string): RoomBoard | null {
  const room = getRoomById(roomId);
  if (!room) return null;

  const problem = getCurrentProblem();
  const memberRows = getDb()
    .prepare(
      `SELECT u.id AS user_id, u.display_name, m.joined_at
       FROM room_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ?
       ORDER BY m.joined_at ASC`,
    )
    .all(roomId) as Array<{ user_id: string; display_name: string; joined_at: string }>;

  const members: RoomMemberStatus[] = memberRows.map((row) => {
    const attempt = problem ? getAttempt(problem.id, row.user_id) : null;
    const submitted = isSubmitted(attempt);
    return {
      userId: row.user_id,
      displayName: row.display_name,
      joinedAt: row.joined_at,
      submitted,
      style: submitted ? attempt?.style : undefined,
      gradedAt: submitted ? attempt?.gradedAt : undefined,
    };
  });

  const waiting = members.filter((m) => !m.submitted);
  const submitted = members.filter((m) => m.submitted);
  const allSubmitted = members.length > 0 && waiting.length === 0;

  let winner: RoomWinner | null = null;
  if (allSubmitted && problem) {
    let best: {
      userId: string;
      displayName: string;
      grade: GradeResult;
      gradedAt: string;
    } | null = null;

    for (const member of members) {
      const attempt = getAttempt(problem.id, member.userId);
      const grade = effectiveGrade(attempt);
      if (!grade || !attempt?.gradedAt) continue;
      if (
        !best ||
        grade.overallScore > best.grade.overallScore ||
        (grade.overallScore === best.grade.overallScore &&
          attempt.gradedAt < best.gradedAt)
      ) {
        best = {
          userId: member.userId,
          displayName: member.displayName,
          grade,
          gradedAt: attempt.gradedAt,
        };
      }
    }

    if (best) {
      winner = {
        userId: best.userId,
        displayName: best.displayName,
        overallScore: best.grade.overallScore,
        overallMax: best.grade.overallMax,
        why: buildWhy(best.grade),
      };
    }
  }

  return {
    room,
    problem,
    members,
    waiting,
    submitted,
    allSubmitted,
    winner,
  };
}
