import { z } from "zod";
import type { Problem } from "@/lib/types";
import {
  DEEP_DIVE_MENU,
  INTERVIEW_OUTLINE_VERSION,
  PHASE_LADDER,
  createInitialSession,
  nextPhaseId,
  phaseMeta,
  type DeepDiveTopic,
  type InterviewMessage,
  type InterviewSessionState,
  type PhaseId,
  type PhaseScore,
} from "@/lib/interview-shared";
import {
  normalizeBoardDataUrl,
  userContentWithOptionalImage,
  type VisionContentPart,
} from "@/lib/vision";

export type { InterviewMessage } from "@/lib/interview-shared";
export { formatInterviewTranscript } from "@/lib/interview-shared";

const turnSchema = z.object({
  /** Empty string = stay silent this turn (no bubble). */
  spokenReply: z.string(),
  /** Hidden checklist only — never narrate phases to the candidate. */
  inferredPhase: z.enum([
    "clarify",
    "envelope",
    "api_model",
    "high_level",
    "deep_dives",
    "wrap",
  ]),
  phaseScore: z.enum(["pass", "partial", "miss"]).nullable().optional(),
  phaseNotes: z.string().optional().default(""),
  nudgeKind: z
    .enum(["none", "lock_requirements", "pick_deep_dive", "wrap_up", "stuck_help"])
    .optional()
    .default("none"),
  deepDivePicks: z
    .array(
      z.enum([
        "consistency",
        "shard_partition",
        "cache",
        "queues_async",
        "failure_modes",
        "hot_keys",
        "search",
        "multi_region",
      ]),
    )
    .optional(),
  interviewComplete: z.boolean().optional().default(false),
});

function cloneSession(state: InterviewSessionState): InterviewSessionState {
  return JSON.parse(JSON.stringify(state)) as InterviewSessionState;
}

function phaseIndex(state: InterviewSessionState, id: PhaseId) {
  return state.phases.findIndex((p) => p.id === id);
}

function markPhase(
  session: InterviewSessionState,
  id: PhaseId,
  score: PhaseScore | null | undefined,
  notes: string,
) {
  const i = phaseIndex(session, id);
  if (i < 0) return;
  if (score) {
    session.phases[i].status = score;
    if (notes) session.phases[i].notes = notes;
  }
}

export async function nextInterviewerTurn(input: {
  problem: Problem;
  messages: InterviewMessage[];
  session?: InterviewSessionState | null;
  stuck?: boolean;
  /** Optional live sketch-board snapshot (data:image/...;base64,...) */
  boardImageDataUrl?: string | null;
}): Promise<{
  reply: string;
  session: InterviewSessionState;
  suggestEnd: boolean;
}> {
  const apiKey = process.env.LLM_API_KEY ?? "";
  if (!apiKey) throw new Error("LLM_API_KEY not set");

  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  let session =
    input.session && input.session.outlineVersion === INTERVIEW_OUTLINE_VERSION
      ? cloneSession(input.session)
      : createInitialSession(input.problem.id, input.problem.slug);

  session.problemId = input.problem.id;
  session.problemSlug = input.problem.slug;

  if (input.messages.length === 0) {
    session = createInitialSession(input.problem.id, input.problem.slug);
  }

  const stuck = Boolean(input.stuck);
  const hiddenSheet = session.phases
    .map((p) => {
      const meta = phaseMeta(p.id);
      return `${p.id}: ${p.status}${p.notes ? ` (${p.notes})` : ""} · clarifyingAsked=${p.clarifyingAsked} · turns=${p.candidateTurns}`;
    })
    .join("\n");

  const deepDiveLabels =
    session.deepDiveTopics.length > 0
      ? session.deepDiveTopics
          .map((id) => DEEP_DIVE_MENU.find((d) => d.id === id)?.label ?? id)
          .join(", ")
      : "(not chosen yet — choose 2–3 silently when they enter deep design)";

  const system = `You are a calm human system-design interviewer. The candidate does NOT see any phase UI.
Outline ${INTERVIEW_OUTLINE_VERSION} is a HIDDEN checklist for you + final grading only.

LOCKED PROBLEM (slug "${input.problem.slug}" — review/grade map here):
Title: ${input.problem.title}
Full prompt:
${input.problem.promptMd}

HIDDEN LADDER (never name these phases out loud, never ask them to "advance"):
${PHASE_LADDER.map((p) => `- ${p.id}: ${p.title} (${p.minutes}) — ${p.goal}`).join("\n")}

Hidden rubric state so far:
${hiddenSheet}
Deep-dive picks (hidden): ${deepDiveLabels}
Menu: ${DEEP_DIVE_MENU.map((d) => d.id).join(", ")}
Candidate marked stuck: ${stuck}

HOW TO BEHAVE:
1. Opening (no prior messages): greet briefly, then give them the FULL problem prompt in your own words (like a human would). Invite them to think aloud / sketch. Then mostly listen.
2. Stay QUIET. Default spokenReply to "" when their answer is fine and they should keep going. Empty reply = silence (no interrupt).
3. If a sketch-board IMAGE is attached on the latest turn, LOOK at it. Soft-nudge from what you see (e.g. missing store, unclear data flow) — still no phase jargon.
4. Soft nudges only (short, natural) — examples:
   - skipped clarify → "Want to lock requirements before drawing boxes?"
   - staying shallow → "Want to pick one deep dive — caching, failure modes, partitioning…?"
   - near end → wrap questions on bottlenecks / more time / tradeoffs
5. Cap interrupts: at most ONE clarifying/nudge question per hidden phase unless stuck=true.
6. Never force phase order on the candidate. Never say "we're in the clarify phase" or "advance to high-level".
7. Silently set inferredPhase to where they actually are. When a phase is covered enough, set phaseScore pass/partial/miss + phaseNotes (for the hidden rubric). You may move inferredPhase forward without speaking.
8. When first inferring deep_dives, set deepDivePicks to 2–3 menu items for THIS problem (do not dump the whole menu unless nudging).
9. End with wrap questions; then interviewComplete=true. Do not reveal scores.

Return ONLY JSON:
{
  "spokenReply": string,          // "" to stay silent
  "inferredPhase": one of the ladder ids,
  "phaseScore": "pass"|"partial"|"miss"|null,  // score the phase you're leaving/covering
  "phaseNotes": string,
  "nudgeKind": "none"|"lock_requirements"|"pick_deep_dive"|"wrap_up"|"stuck_help",
  "deepDivePicks": string[] | omit,
  "interviewComplete": boolean
}`;

  const boardImage = normalizeBoardDataUrl(input.boardImageDataUrl);

  type ChatMsg = {
    role: "assistant" | "user";
    content: string | VisionContentPart[];
  };

  const chatMessages: ChatMsg[] =
    input.messages.length === 0
      ? [
          {
            role: "user",
            content:
              "Start the interview: brief greeting + present the full problem prompt naturally. Invite free-talk / sketching. No phase checklist language.",
          },
        ]
      : input.messages.map((m, idx) => {
          const role = (m.role === "interviewer" ? "assistant" : "user") as
            | "assistant"
            | "user";
          const text = m.content || "(interviewer stayed silent)";
          const isLastCandidate =
            role === "user" && idx === input.messages.length - 1 && boardImage;
          return {
            role,
            content: isLastCandidate
              ? userContentWithOptionalImage(
                  `(Candidate's current diagram/sketch is attached — look at it.)`,
                  boardImage,
                )
              : text,
          };
        });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...chatMessages],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty interviewer reply");

  const parsed = turnSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(`Invalid interviewer JSON: ${parsed.error.message}`);
  }

  const turn = parsed.data;
  const last = input.messages[input.messages.length - 1];
  if (last?.role === "candidate") {
    const cur = session.phases[phaseIndex(session, session.currentPhase)];
    if (cur) cur.candidateTurns += 1;
  }

  // Soft-nudge interrupt cap per hidden phase
  const inferred = turn.inferredPhase;
  const inferredState = session.phases[phaseIndex(session, inferred)];
  let reply = turn.spokenReply.trim();
  if (
    reply &&
    turn.nudgeKind !== "none" &&
    inferredState?.clarifyingAsked &&
    !stuck
  ) {
    reply = ""; // already used the one soft interrupt
  }
  if (reply && turn.nudgeKind !== "none" && inferredState) {
    inferredState.clarifyingAsked = true;
  }

  if (turn.deepDivePicks && turn.deepDivePicks.length >= 2) {
    const picks = turn.deepDivePicks.filter((id, i, arr) => arr.indexOf(id) === i).slice(0, 3);
    if (picks.length >= 2) session.deepDiveTopics = picks as DeepDiveTopic[];
  } else if (
    (inferred === "deep_dives" || inferred === "wrap") &&
    session.deepDiveTopics.length === 0
  ) {
    session.deepDiveTopics = pickFallbackDeepDives(input.problem);
  }

  // Score phases silently; allow forward motion on hidden ladder
  if (turn.phaseScore) {
    markPhase(session, session.currentPhase, turn.phaseScore, turn.phaseNotes);
    // Also stamp the inferred phase if different and scored
    if (inferred !== session.currentPhase) {
      markPhase(session, inferred, turn.phaseScore, turn.phaseNotes);
    }
  }

  // Advance hidden pointer to inferred phase (never shown to candidate)
  const order = PHASE_LADDER.map((p) => p.id);
  const curIdx = order.indexOf(session.currentPhase);
  const infIdx = order.indexOf(inferred);
  if (infIdx >= curIdx) {
    // Fill pending scores lightly when jumping forward in inference
    for (let i = curIdx; i < infIdx; i++) {
      const id = order[i];
      const p = session.phases[phaseIndex(session, id)];
      if (p && p.status === "pending" && p.candidateTurns > 0) {
        p.status = "partial";
        p.notes = p.notes || "Inferred coverage while candidate drove ahead";
      }
    }
    session.currentPhase = inferred;
  } else if (turn.phaseScore && nextPhaseId(session.currentPhase)) {
    // scored current — step one forward quietly
    const nxt = nextPhaseId(session.currentPhase);
    if (nxt && order.indexOf(nxt) <= infIdx) session.currentPhase = nxt;
  }

  if (turn.interviewComplete || inferred === "wrap") {
    const wrap = session.phases[phaseIndex(session, "wrap")];
    if (wrap && wrap.status === "pending" && turn.phaseScore) {
      wrap.status = turn.phaseScore;
      wrap.notes = turn.phaseNotes || wrap.notes;
    }
    if (turn.interviewComplete) {
      session.complete = true;
      session.currentPhase = "wrap";
    }
  }

  return {
    reply,
    session,
    suggestEnd: session.complete,
  };
}

function pickFallbackDeepDives(problem: Problem): DeepDiveTopic[] {
  const text = `${problem.title}\n${problem.promptMd}`.toLowerCase();
  const picks: DeepDiveTopic[] = [];
  if (text.includes("search")) picks.push("search");
  if (text.includes("cache") || text.includes("cdn")) picks.push("cache");
  if (text.includes("queue") || text.includes("async") || text.includes("feed")) {
    picks.push("queues_async");
  }
  if (text.includes("shard") || text.includes("partition") || text.includes("scale")) {
    picks.push("shard_partition");
  }
  if (text.includes("region") || text.includes("geo")) picks.push("multi_region");
  picks.push("failure_modes");
  picks.push("consistency");
  return [...new Set(picks)].slice(0, 3) as DeepDiveTopic[];
}
