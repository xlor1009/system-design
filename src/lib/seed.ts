import { v4 as uuid } from "uuid";
import type BetterSqlite3 from "better-sqlite3";

const ROADMAP_TOPICS = [
  "Requirements & estimation",
  "Load balancer & reverse proxy",
  "Caching (CDN + Redis)",
  "Database sharding & replication",
  "URL shortener deep dive",
  "Message queues & async processing",
  "Rate limiting",
  "Consistent hashing",
  "Blob storage & CDN",
  "Observability & SLOs",
];

export function seedIfEmpty(db: BetterSqlite3.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS c FROM roadmap_items").get() as { c: number };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const insertRoadmap = db.prepare(
    `INSERT INTO roadmap_items (id, topic, order_index, notes_md, source_url)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    ROADMAP_TOPICS.forEach((topic, i) => {
      insertRoadmap.run(uuid(), topic, i + 1, null, null);
    });

    db.prepare(
      `INSERT INTO roadmap_cursor (id, next_order_index, updated_at) VALUES (1, 1, ?)`,
    ).run(now);

    const problemId = uuid();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    db.prepare(
      `INSERT INTO problems (
        id, slug, title, prompt_md, timebox_minutes, rubric_version,
        admin_outline_md, week_of, due_at, source_url, source_roadmap_topic,
        notified_at, discord_message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    ).run(
      problemId,
      "url-shortener-2026-w40",
      "Design a URL Shortener",
      `# Design a URL Shortener

Build a service that takes long URLs and returns short links.

## Goals
- Create short URLs
- Redirect short URLs to originals
- Track click counts (optional stretch)

## Constraints
- 100M new URLs / month
- Read-heavy (100:1)
- 99.9% availability
- Latency under 100ms for redirects

## Deliverables
1. Diagram of components and data flow
2. Spoken walkthrough (record audio)
3. Transcript of your explanation
4. Short caption for the diagram

Timebox: 45 minutes.`,
      45,
      "rubric_v1",
      `## Admin outline
- Hash vs base62 counter
- DB schema (short_code, long_url, created_at, clicks)
- Cache hot redirects
- Analytics async via queue`,
      "2026-W40",
      due.toISOString(),
      null,
      "URL shortener deep dive",
      now,
    );

    db.prepare(
      `INSERT INTO curated_queue (problem_id, order_index, week_of) VALUES (?, 1, ?)`,
    ).run(problemId, "2026-W40");
  });

  tx();
}
