---
name: Study Loop V1
overview: "Build a friends-only system-design study loop as a Next.js app on Railway: SQLite + local volume storage, server-side capture (diagram + MediaRecorder audio), LLM rubric grading, Discord weekly publish — escalate to Supabase only if the Railway box is not enough."
todos:
  - id: scaffold
    content: Scaffold Next.js app in study-loop workspace; Railway volume + SQLite/Drizzle schema; password auth
    status: pending
  - id: submit-capture
    content: "Problem page: diagram upload, MediaRecorder webm upload, transcript+caption, Attempt CRUD + review artifacts"
    status: pending
  - id: grade-job
    content: Server grade job with rubric_v1 JSON validation + review UI
    status: pending
  - id: roadmap-admin-cron
    content: Roadmap seed, /admin/new, Discord publish cron + seed URL-shortener problem
    status: pending
  - id: verify-skill
    content: "After app runs: generate .cursor/skills/verify-study-loop (Launch/Doctor/Drive/Evidence/Cleanup + feature map); prove one feature end-to-end"
    status: pending
isProject: false
---

# System Design Study Loop — V1 Plan

## Locked decisions

- **Host:** Railway long-running Next.js service (not Vercel serverless). Cron via Railway cron / scheduled hit to an authenticated internal route.
- **DB:** SQLite on a **Railway volume** (`/data/app.db`). Escalate to Supabase Postgres only if volume/SQLite limits bite.
- **Files “all on server”:** Diagram PNG/SVG/`.excalidraw` + browser `MediaRecorder` `.webm` uploaded and stored under `/data/uploads/...` on the same volume. **No Loom/Drive URLs.**
- **Transcript:** Required pasted text for V1 grading (Whisper later). Audio still stored for same-URL review playback.
- **Diagram for grader:** Participant **caption** field (no vision in V1).
- **Auth:** Shared `GROUP_PASSWORD` cookie + display name.
- **Grades:** Private only.
- **Notify:** Discord webhook; Sunday 10:00 America/New_York; idempotent via `notified_at` / `discord_message_id`.
- **Content:** Deep-link roadmap.sh; store our rewrite + `source_url` to systemdesign.io — never scrape full solutions.

## Workspace

Current root `[D:\bye\system-design\New Text Document.txt](D:\bye\system-design\New Text Document.txt)` is an empty git folder. Scaffold the app as `D:\bye\system-design\study-loop` (or rename this root) and point the agent workspace there before coding.

## Architecture

```mermaid
flowchart LR
  subgraph client [Browser]
    PW[Password gate]
    Prob[Problem page]
    Rec[MediaRecorder]
  end
  subgraph railway [Railway service]
    Next[Next.js App Router]
    Grade[Grade job]
    Cron[Publish cron]
    SQL[(SQLite /data)]
    Files[/data/uploads]
  end
  LLM[OpenAI or Anthropic]
  Discord[Discord webhook]
  PW --> Next
  Prob --> Next
  Rec -->|webm upload| Next
  Next --> SQL
  Next --> Files
  Next --> Grade
  Grade --> LLM
  Grade --> SQL
  Cron --> SQL
  Cron --> Discord
```



## Stack


| Piece   | Choice                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| App     | Next.js App Router + TypeScript                                                |
| DB      | `better-sqlite3` (or `drizzle` + better-sqlite3) on volume path                |
| Uploads | Multipart → `/data/uploads/{problemId}/{userId}/...`                           |
| Auth    | Cookie after `GROUP_PASSWORD`; store `display_name` in cookie/session          |
| LLM     | Server-only `LLM_API_KEY`; structured JSON validate against rubric_v1          |
| Deploy  | `railway.toml` / Dockerfile if native module needs it; mount volume at `/data` |


## Routes (V1)

- `/` — this week’s problem CTA + roadmap teaser
- `/roadmap` — ≥8 ordered topics deep-linked to roadmap.sh
- `/problems/{slug}` — prompt, timebox, submit (diagram file + audio record/upload + transcript + caption); after submit: artifacts + grade review
- `/admin/new` — password-gated create/publish problem (+ “Publish + Discord” if queue empty)
- `POST /api/cron/publish-next` — advance cursor, create Problem, Discord webhook (secret header); no double-post

## Data model

Implement as in the design doc: `User`, `Problem`, `Attempt` (one per user/problem, resubmit overwrites), `RoadmapItem`, `CuratedQueueItem`, `RoadmapCursor`. Store `diagram_path`, `audio_path`, `transcript_text`, `diagram_caption`, `grade_json`, `graded_at`. Include human `grade_override_json` nullable for unfair-grade mitigation.

## Grading

On submit (or short server queue): build prompt from `prompt_md` + optional `admin_outline_md` + rubric_v1 + transcript + caption → LLM → validate JSON schema → save. Fail closed if transcript empty or diagram missing.

## Seed content (acceptance)

- ≥8 `RoadmapItem` rows linking out
- One curated URL-shortener problem stub (`url-shortener-2026-w40`) with rewrite + `source_url`
- Static `rubric_v1` markdown/JSON in repo

## Env (Railway)

`GROUP_PASSWORD`, `LLM_API_KEY`, `DISCORD_WEBHOOK_URL`, `CRON_SECRET`, `APP_ORIGIN`, `DATA_DIR=/data`

## Build order (match doc evenings)

1. Scaffold Next app + SQLite schema + password gate + volume path helpers
2. Problem page + uploads (diagram + MediaRecorder) + attempt persist + review without grade
3. Grade job + review UI (scores / strengths / gaps / next_practice)
4. Roadmap + admin new/publish + Discord cron + first seed problem
5. **Verification skill** (only after the app starts cleanly locally) — see below

## Verification skill (`/create-verification-skill`)

Do **not** write the skill against the empty workspace. After evenings 1–4 produce a runnable app, interview the checkout and generate:

- [`.cursor/skills/verify-study-loop/SKILL.md`](.cursor/skills/verify-study-loop/SKILL.md) — YAML `name: verify-study-loop`; sections **Launch**, **Doctor**, **Drive**, **Evidence**, **Cleanup**, **Helpers**
- [`.cursor/skills/verify-study-loop/features/`](.cursor/skills/verify-study-loop/features/) — README index + one file per feature (shape from pstack feature-map-example)

**Interview defaults (confirm from repo when built):**

| Question | Planned answer |
|----------|----------------|
| Surface | Web UI (primary); `POST /api/cron/publish-next` secondary |
| Run | `npm run dev` (or repo script); `DATA_DIR` + `GROUP_PASSWORD` + optional `LLM_API_KEY` / Discord dry-run |
| Drive | Browser/CDP (cursor-ide-browser or Playwright); curl for cron with `CRON_SECRET` |
| Observe | Screenshots + ARIA snapshots; SQLite attempt/grade rows; files under `$DATA_DIR/uploads`; Discord only if dry-run/log mode proves skip |
| Isolate | Fresh `DATA_DIR=./.verify-data-$RUN_ID`, free port; never drive a shared/prod instance |

**Initial feature map (top 5):**

1. **Password gate** — wrong password blocked; correct password + display name reaches `/`
2. **Submit attempt** — diagram + webm + transcript + caption → Attempt row + files on disk; same URL shows artifacts
3. **Grade review** — valid `grade_json` (or fail-closed) + strengths/gaps on reload (LLM mock/fixture allowed only if production already isolates that boundary)
4. **Roadmap** — ≥8 deep-linked topics visible
5. **Admin publish / cron** — create problem or cron advances cursor; Discord idempotent (assert webhook dry-run / no double `notified_at`)

**Prove before handoff:** Launch → Doctor → drive **one** mapped feature (prefer submit attempt) → capture evidence under a named artifacts dir → Cleanup without deleting evidence → confirm artifacts still exist. Point user at `/maintain-verification-skill` afterward.

**UI contract for verifiability (bake into build):** stable `data-testid` or accessible names on password form, display name, diagram upload, record/stop, transcript, caption, submit, score breakdown, roadmap links, admin publish.

## Out of scope V1

Live multiplayer board, Loom, Whisper, vision grading, leaderboard, Clerk/SSO, Supabase (unless SQLite/volume fails), Discord bot/slash commands.