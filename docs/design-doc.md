# System Design Study Loop — Design Doc

**Owner:** Amin + friends  
**Goal:** Weekly motivation to practice system design interviews (roadmap → timed problem → whiteboard + audio → AI+rubric grade → same-URL review).  
**Non-goal:** Public SaaS, marketplaces, multi-tenant billing, or “best AI grader in the world.” Third-party LLM + fixed rubric is enough.

**Constraint:** Side project next to daycare outreach + job hunt. Prefer thin V1; no weeknight rabbit hole.

---

## 1. Problem

Friends studying system design need:

1. A shared path (roadmap) so they aren’t picking random problems.
2. A recurring weekly prompt with a stable URL.
3. Capture that feels interview-like (diagram + spoken explanation).
4. An impartial score so comparison isn’t “whoever talks loudest.”
5. A place to reopen last week’s attempt and see what was good/bad.

---

## 2. Users & flows

**Roles (V1):**

| Role | Who | Capabilities |
|------|-----|--------------|
| Admin | You (or rotating friend) | Pick/post weekly problem, link roadmap |
| Participant | All friends | Open problem link, submit attempt, view own + optional peer grades |

**Happy path (weekly):**

1. Admin publishes Problem `#N` at `/problems/{slug}` (also in Discord/Notion).
2. Participant opens link → sees prompt, timebox (e.g. 45–60 min), rubric link.
3. Participant draws on embedded whiteboard (or uploads Excalidraw export) + records audio (or uploads Loom URL).
4. Participant hits **Submit** → server stores artifacts + calls LLM with rubric → stores grade JSON.
5. Same URL later shows: prompt, their diagram, audio, score breakdown, “what was strong / missing,” optional model solution notes (admin-authored, not auto-invented).

**Out of scope V1:** live multiplayer whiteboard, real-time peer judging UI, mobile-first recording, auth SSO beyond simple magic link / shared password.

---

## 3. Product surface (pages)

| Route | Purpose |
|-------|---------|
| `/` | Roadmap index + “This week’s problem” CTA |
| `/roadmap` | Ordered topic list keyed to [roadmap.sh/system-design](https://roadmap.sh/system-design); deep-links out; status (not started / done) |
| `/problems/{slug}` | Problem statement, timer optional, submit form, **and** after submit: review pane for that user’s attempt |
| `/problems/{slug}/mine` (optional) | Alias for “my attempt” if multi-user on same page |
| `/admin/new` | Create problem: title, prompt MD, timebox, rubric version, due date, optional reference outline |

Keep auth minimal: magic link or single shared group password + display name.

---

## 4. Rubric (the “third party” contract)

Version the rubric (`rubric_v1`). LLM must score **only** these dimensions 1–5 + one-sentence evidence each:

1. **Requirements & clarification** — goals, constraints, NFRs called out  
2. **High-level design** — correct major components and data flow  
3. **Deep dive** — API / data model / consistency / scaling where relevant  
4. **Tradeoffs** — at least two real alternatives with costs  
5. **Communication** — structure of spoken explanation; diagram matches talk track  

**Output schema (store as JSON):**

```json
{
  "rubric_version": "v1",
  "scores": {
    "requirements": { "score": 1-5, "evidence": "..." },
    "high_level": { "score": 1-5, "evidence": "..." },
    "deep_dive": { "score": 1-5, "evidence": "..." },
    "tradeoffs": { "score": 1-5, "evidence": "..." },
    "communication": { "score": 1-5, "evidence": "..." }
  },
  "total": 0-25,
  "strengths": ["...", "..."],
  "gaps": ["...", "..."],
  "next_practice": "one concrete drill for next week"
}
```

**Rules for the grader prompt:**

- Fail closed: if audio/transcript missing or empty diagram, score communication/high_level low and say why — don’t invent content.
- Never invent a “correct” architecture beyond what’s in an optional `admin_outline` field.
- Compare peers only if admin enables “anonymous leaderboard” (optional V1.1); default is private grades.

---

## 5. Capture model

**Whiteboard (pick one for V1):**

- **A (fastest):** Upload PNG/SVG or paste Excalidraw `.excalidraw` JSON  
- **B (nicer):** Embed tldraw or Excalidraw; snapshot to PNG on submit  

**Audio:**

- **A (fastest):** Paste Loom / Drive / Zoom URL  
- **B:** Browser MediaRecorder → upload `.webm` to object storage  

**Transcript (for grading):**

- If URL-only: participant pastes transcript OR you run Whisper later (V1.1)  
- If uploaded audio: Whisper (local or API) → text stored with attempt  

**Recommendation for first build:** Excalidraw export + Loom URL + optional pasted transcript. Add recorder/Whisper only after 2–3 weeks of habit.

---

## 6. Data model (minimal)

```
User { id, display_name, email? }
Problem {
  id, slug, title, prompt_md, timebox_minutes,
  rubric_version, admin_outline_md?, week_of, due_at,
  source_url?, source_roadmap_topic?,
  notified_at?, discord_message_id?, created_at
}
CuratedQueueItem { id, order, title, source_url, roadmap_topic, used_at? }
RoadmapCursor { id=1, next_order }
Attempt {
  id, problem_id, user_id,
  diagram_url | diagram_json,
  audio_url?, transcript_text?,
  grade_json?, graded_at?,
  created_at, updated_at
}
RoadmapItem { id, order, title, external_url, topic_tag }
```

One attempt per user per problem for V1 (overwrite allowed with “resubmit” flag).

---

## 7. Tech sketch (suggested, not mandatory)

| Layer | Simple choice |
|-------|----------------|
| App | Next.js (App Router) on Vercel — matches your ANSR stack familiarity |
| DB | Postgres (Neon/Supabase) or even SQLite+Turso for friend-scale |
| Files | S3-compatible (R2 / Supabase storage) for PNG/webm |
| Auth | Clerk magic link **or** single env `GROUP_PASSWORD` + cookie |
| Grade job | Server action or Inngest/cron: build prompt → OpenAI/Anthropic → validate JSON → save |
| Weekly notify | Vercel cron / Inngest → Discord webhook |
| Secrets | `LLM_API_KEY`, `DISCORD_WEBHOOK_URL` only on server |

**Grade job inputs:** `prompt_md` + `admin_outline_md?` + `rubric_v1` + `transcript` + diagram description (or vision if you pass PNG to a multimodal model).

**Multimodal path (optional):** send diagram image to vision model; otherwise require a short “diagram caption” text field from the participant.

---

## 8. Weekly ops ritual (mostly automatic)

**Default cadence:** Sunday 10:00 AM America/New_York (configurable cron).

1. Cron job runs `publishNextProblem()`:
   - Advance roadmap cursor to next topic
   - Resolve next unused systemdesign.io question mapped to that topic (or admin-curated queue)
   - Create `Problem` row + stable `/problems/{slug}`
   - POST Discord webhook (or bot) with the link + timebox + due date
2. Everyone submits by Wednesday night (due timestamp on Problem).
3. Optional Thursday debrief in Discord voice.
4. Same URL stays forever as the review archive.

**Discord delivery (V1):**

- One channel webhook URL in env `DISCORD_WEBHOOK_URL`
- Message template:
  `System design week {n}: **{title}** — {app_origin}/problems/{slug} | Due {due} | Source: {source_url}`
- Idempotent: store `discord_message_id` / `notified_at` on Problem so cron never double-posts
- Fail soft: if webhook fails, email/SMS admin (or log + retry once); still keep the Problem URL live

**Semi-auto fallback:** admin can hit “Publish + notify Discord” on `/admin/new` if the curated queue is empty.

**Not V1:** Discord slash commands, per-user DMs, grading replies in-thread (nice later: bot posts “grades ready” when all submitted).

Kill the site if nobody opens the link for 3 weeks — keep Excalidraw+Loom+ChatGPT paste instead.

---

## 9. V1 acceptance criteria

- [ ] Roadmap page with ≥8 ordered topics deep-linked from roadmap.sh/system-design
- [ ] At least one problem sourced from systemdesign.io (title + rewrite + `source_url`)  
- [ ] Create + publish one problem at stable slug URL  
- [ ] Submit diagram (file or embed snapshot) + audio URL + transcript text  
- [ ] LLM returns valid `grade_json` against rubric_v1  
- [ ] Reloading the same URL shows artifacts + strengths/gaps  
- [ ] No public signup; friends-only access
- [ ] Weekly cron (or Publish button) posts one Discord webhook with the problem URL; no double-post  

**Explicit non-goals for V1:** payments, SEO, mobile app, live collaborative board, automatic “who is best” leaderboard, building your own STT.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| AI grades feel unfair | Versioned rubric + evidence quotes; allow human override field on Attempt |
| Build eats weeknights | Ship upload+URL path first; no custom recorder |
| Empty / fake submissions | Fail-closed grader; require non-empty transcript |
| Scope creep into edtech startup | Friends-only forever until daycare GTM is boring |

---

## 11. Suggested build order (≈3–4 evenings)

1. **Evening 1:** Next app + Problem + Attempt schema + static rubric MD + password gate  
2. **Evening 2:** Problem page + upload diagram + Loom + transcript fields + list attempts  
3. **Evening 3:** Grade job + review UI (scores, strengths, gaps)  
4. **Evening 4:** Roadmap page + admin “new problem” form + first real week with friends  

---

## 12. Open decisions (pick before coding)

1. Excalidraw upload vs tldraw embed?  
2. Loom URL vs browser recorder?  
3. Auth: magic link vs shared password?  
4. Vision on diagram PNG vs caption-only?  
5. Private grades only vs anonymous weekly leaderboard?
6. Discord webhook vs Discord bot?

Default if undecided: **upload + Loom + shared password + caption-only + private grades + Discord webhook cron Sundays 10am ET.**

---

---

## 13. Content sources (locked 2026-09-30)

| Source | Role | How we use it |
|--------|------|----------------|
| [roadmap.sh/system-design](https://roadmap.sh/system-design) | Learning path / topic order | Roadmap page mirrors its topic order; each item links out. Do not copy their full diagram/text into our DB — deep-link. |
| [systemdesign.io](https://systemdesign.io/) | Weekly problem bank | Admin picks one interview question per week; store **title + our own prompt rewrite + link** to their page. Do not paste their full solutions into the app. |

**Weekly pick rule:** Topic from roadmap.sh for that week → matching (or adjacent) question from systemdesign.io → publish at `/problems/{slug}` with external `source_url`.

**Copyright / ethics:** Link out. Our value is the attempt capture + AI+rubric grade + same-URL review, not republishing their answers. `admin_outline` should be short bullets you write, not scraped solution text.

**Data fields to add:**

```
Problem.source_roadmap_topic  # e.g. "Caching"
Problem.source_url            # systemdesign.io question URL
RoadmapItem.external_url      # roadmap.sh node or related primer
```

## Appendix A — Example weekly problem stub

**Slug:** `url-shortener-2026-w40`  
**Title:** Design a URL shortener  
**Timebox:** 45 minutes  
**Prompt:** Functional + non-functional requirements, API, storage, redirect path, analytics, scale to 100M URLs, failure modes.  
**Admin outline (hidden from participants until after due):** hash vs counter IDs; cache; DB sharding note; 301 vs 302 — bullets only, not a full essay.

---

## Appendix B — Rubric one-liner for the LLM system prompt

You are a strict system-design interview grader. Score only the five rubric dimensions. Cite evidence from the transcript and diagram caption. If evidence is missing, score low and say what is missing. Output JSON matching the schema. Do not invent architecture the candidate did not mention unless it appears in admin_outline, and even then only as a gap (“did not discuss X”), never as if they said it.
