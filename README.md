# System Design Study Loop

Friends-only weekly system-design practice: roadmap → timed problem → diagram + audio → AI rubric grade → same-URL review.

## Stack

- Next.js App Router on Railway
- SQLite on a Railway volume (`DATA_DIR`)
- Shared group password auth
- Discord webhook for weekly publish

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Set `GROUP_PASSWORD`, `DATA_DIR=./.data`, and optionally `LLM_API_KEY`.

Cron dry-run (no Discord webhook):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish-next
```
