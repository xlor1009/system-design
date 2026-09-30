import { v4 as uuid } from "uuid";
import type BetterSqlite3 from "better-sqlite3";
import {
  CURATED_PROBLEMS,
  ROADMAP_SOURCE_URL,
  ROADMAP_TOPICS,
} from "@/lib/curated-content";

function weekOfFromSlug(slug: string, index: number): string {
  const m = /-(\d{4})-w(\d{2})$/i.exec(slug);
  if (m) return `${m[1]}-W${m[2]}`;
  const year = new Date().getFullYear();
  return `${year}-W${String(40 + index).padStart(2, "0")}`;
}

function dueAtForIndex(index: number): string {
  const due = new Date();
  due.setDate(due.getDate() + 7 * (index + 1));
  return due.toISOString();
}

function ensureRoadmap(db: BetterSqlite3.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS c FROM roadmap_items").get() as {
    c: number;
  };

  if (count.c === 0) {
    const insert = db.prepare(
      `INSERT INTO roadmap_items (id, topic, order_index, notes_md, source_url)
       VALUES (?, ?, ?, ?, ?)`,
    );
    ROADMAP_TOPICS.forEach((item, i) => {
      insert.run(
        uuid(),
        item.topic,
        i + 1,
        item.notesMd ?? null,
        item.sourceUrl,
      );
    });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR IGNORE INTO roadmap_cursor (id, next_order_index, updated_at)
       VALUES (1, 1, ?)`,
    ).run(now);
    return;
  }

  // Backfill deep-links on older seeds
  db.prepare(
    `UPDATE roadmap_items SET source_url = ?
     WHERE source_url IS NULL OR source_url = ''`,
  ).run(ROADMAP_SOURCE_URL);
}

function ensureCuratedProblems(db: BetterSqlite3.Database): void {
  const now = new Date().toISOString();
  const insertProblem = db.prepare(
    `INSERT INTO problems (
      id, slug, title, prompt_md, timebox_minutes, rubric_version,
      admin_outline_md, week_of, due_at, source_url, source_roadmap_topic,
      notified_at, discord_message_id, created_at
    ) VALUES (?, ?, ?, ?, ?, 'rubric_v1', ?, ?, ?, ?, ?, NULL, NULL, ?)`,
  );
  const updateSource = db.prepare(
    `UPDATE problems
     SET source_url = COALESCE(NULLIF(source_url, ''), ?),
         source_roadmap_topic = COALESCE(NULLIF(source_roadmap_topic, ''), ?),
         prompt_md = CASE
           WHEN prompt_md IS NULL OR length(prompt_md) < 40 THEN ?
           ELSE prompt_md
         END,
         admin_outline_md = COALESCE(admin_outline_md, ?)
     WHERE slug = ?`,
  );
  const insertQueue = db.prepare(
    `INSERT INTO curated_queue (problem_id, order_index, week_of)
     VALUES (?, ?, ?)`,
  );
  const hasQueue = db.prepare(
    `SELECT 1 AS ok FROM curated_queue WHERE problem_id = ?`,
  );
  const maxOrderRow = db
    .prepare(`SELECT COALESCE(MAX(order_index), 0) AS m FROM curated_queue`)
    .get() as { m: number };
  let nextOrder = maxOrderRow.m;

  CURATED_PROBLEMS.forEach((p, index) => {
    const existing = db
      .prepare(`SELECT id FROM problems WHERE slug = ?`)
      .get(p.slug) as { id: string } | undefined;

    const weekOf = weekOfFromSlug(p.slug, index);

    if (existing) {
      updateSource.run(
        p.sourceUrl,
        p.sourceRoadmapTopic,
        p.promptMd,
        p.adminOutlineMd,
        p.slug,
      );
      const queued = hasQueue.get(existing.id) as { ok: number } | undefined;
      if (!queued) {
        nextOrder += 1;
        insertQueue.run(existing.id, nextOrder, weekOf);
      }
      return;
    }

    const id = uuid();
    insertProblem.run(
      id,
      p.slug,
      p.title,
      p.promptMd,
      p.timeboxMinutes,
      p.adminOutlineMd,
      weekOf,
      dueAtForIndex(index),
      p.sourceUrl,
      p.sourceRoadmapTopic,
      now,
    );
    nextOrder += 1;
    insertQueue.run(id, nextOrder, weekOf);
  });
}

/** Idempotent: safe on every boot. Fills roadmap + curated systemdesign.io bank. */
export function seedIfEmpty(db: BetterSqlite3.Database): void {
  const tx = db.transaction(() => {
    ensureRoadmap(db);
    ensureCuratedProblems(db);
  });
  tx();
}
