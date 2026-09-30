export type InterviewMessage = {
  role: "interviewer" | "candidate";
  content: string;
};

/** Locked outline for every weekly problem — keep stable for comparable grades. */
export const INTERVIEW_OUTLINE_VERSION = "phase_ladder_v1" as const;

export type PhaseId =
  | "clarify"
  | "envelope"
  | "api_model"
  | "high_level"
  | "deep_dives"
  | "wrap";

export type PhaseScore = "pass" | "partial" | "miss";

export type DeepDiveTopic =
  | "consistency"
  | "shard_partition"
  | "cache"
  | "queues_async"
  | "failure_modes"
  | "hot_keys"
  | "search"
  | "multi_region";

export const PHASE_LADDER: Array<{
  id: PhaseId;
  title: string;
  minutes: string;
  goal: string;
  mustHaves: string[];
  /** Soft cap on candidate replies before the AI should score & advance. */
  targetCandidateTurns: number;
}> = [
  {
    id: "clarify",
    title: "Clarify",
    minutes: "2–3 min",
    goal: "Functional requirements, non-goals, scale guesses, latency/consistency must-haves.",
    mustHaves: [
      "Functional requirements",
      "Non-goals",
      "Scale guesses (users / QPS / data)",
      "Latency or consistency must-haves",
    ],
    targetCandidateTurns: 2,
  },
  {
    id: "envelope",
    title: "Back-of-envelope",
    minutes: "2 min",
    goal: "Rough traffic, storage, bandwidth — enough to justify later choices; no fake precision.",
    mustHaves: ["Traffic estimate", "Storage or bandwidth estimate", "Link estimates to later design"],
    targetCandidateTurns: 1,
  },
  {
    id: "api_model",
    title: "API / data model",
    minutes: "3–5 min",
    goal: "Core endpoints or events + main entities. API must cover stated requirements.",
    mustHaves: ["Core endpoints or events", "Main entities", "API covers clarified requirements"],
    targetCandidateTurns: 2,
  },
  {
    id: "high_level",
    title: "High-level design",
    minutes: "8–12 min",
    goal: "Boxes and arrows for the happy path; read/write coverage + one clear store choice.",
    mustHaves: ["Happy-path components", "Read path", "Write path", "One clear data store choice"],
    targetCandidateTurns: 3,
  },
  {
    id: "deep_dives",
    title: "Deep dives",
    minutes: "rest of time",
    goal: "2–3 topics from the fixed menu. Candidate drives; AI probes gaps.",
    mustHaves: ["Two or three menu topics covered with tradeoffs"],
    targetCandidateTurns: 4,
  },
  {
    id: "wrap",
    title: "Wrap",
    minutes: "2 min",
    goal: "Bottlenecks, what you’d do with more time, tradeoffs accepted.",
    mustHaves: ["Bottlenecks", "More time / next steps", "Tradeoffs accepted"],
    targetCandidateTurns: 1,
  },
];

export const DEEP_DIVE_MENU: Array<{ id: DeepDiveTopic; label: string }> = [
  { id: "consistency", label: "Consistency" },
  { id: "shard_partition", label: "Shard / partition" },
  { id: "cache", label: "Cache" },
  { id: "queues_async", label: "Queues / async" },
  { id: "failure_modes", label: "Failure modes" },
  { id: "hot_keys", label: "Hot keys" },
  { id: "search", label: "Search" },
  { id: "multi_region", label: "Multi-region" },
];

export type PhaseRubric = {
  id: PhaseId;
  status: PhaseScore | "pending";
  notes: string;
  clarifyingAsked: boolean;
  candidateTurns: number;
};

export type InterviewSessionState = {
  outlineVersion: typeof INTERVIEW_OUTLINE_VERSION;
  problemId: string;
  problemSlug: string;
  currentPhase: PhaseId;
  phases: PhaseRubric[];
  deepDiveTopics: DeepDiveTopic[];
  complete: boolean;
};

export type InterviewOutlinePayload = InterviewSessionState & {
  messages: InterviewMessage[];
};

export function createInitialSession(problemId: string, problemSlug: string): InterviewSessionState {
  return {
    outlineVersion: INTERVIEW_OUTLINE_VERSION,
    problemId,
    problemSlug,
    currentPhase: "clarify",
    phases: PHASE_LADDER.map((p) => ({
      id: p.id,
      status: "pending",
      notes: "",
      clarifyingAsked: false,
      candidateTurns: 0,
    })),
    deepDiveTopics: [],
    complete: false,
  };
}

export function phaseMeta(id: PhaseId) {
  return PHASE_LADDER.find((p) => p.id === id)!;
}

export function nextPhaseId(id: PhaseId): PhaseId | null {
  const i = PHASE_LADDER.findIndex((p) => p.id === id);
  if (i < 0 || i >= PHASE_LADDER.length - 1) return null;
  return PHASE_LADDER[i + 1].id;
}

export function formatInterviewTranscript(messages: InterviewMessage[]): string {
  return messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n\n");
}

export function formatPhaseRubricSheet(state: InterviewSessionState): string {
  return state.phases
    .map((p) => {
      const meta = phaseMeta(p.id);
      return `- ${meta.title} (${meta.minutes}): ${p.status.toUpperCase()}${p.notes ? ` — ${p.notes}` : ""}`;
    })
    .join("\n");
}
