# Study Loop design synthesis

## Base

Locked V1 plan. Arena skipped after tool aborts. Shape is modular domain cores behind thin Next.js routes.

## Domain

Attempt is the load-bearing record. One per (userId, problemId). Resubmit upserts paths and clears grade until regrade.

PublishNext is idempotent. If notified_at is set, cron is a no-op for Discord.

## Modules

- lib/db.ts — SQLite open under DATA_DIR
- lib/auth.ts — password cookie + display name
- lib/storage.ts — upload paths under DATA_DIR/uploads
- lib/grade.ts — rubric_v1 prompt + JSON parse
- lib/publish.ts — cursor advance + Discord webhook

## Remote

Target origin https://github.com/xlor1009/system-design.git
GitHub MCP token got 404/403 on that repo. Push needs local git with the operator's credentials.
