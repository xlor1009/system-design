import type { Problem } from "@/lib/types";
import { claimNextUnpublishedProblem, setDiscordMessageId } from "@/lib/db";

export type PublishResult = {
  ok: boolean;
  dryRun?: boolean;
  problem?: { id: string; slug: string; title: string };
  message?: string;
  error?: string;
};

function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

function buildMessage(problem: Problem): string {
  const url = `${appBaseUrl()}/problems/${problem.slug}`;
  return [
    `**Weekly system design:** ${problem.title}`,
    `Week: ${problem.weekOf} · Due: ${problem.dueAt}`,
    `Timebox: ${problem.timeboxMinutes} min`,
    `Open: ${url}`,
  ].join("\n");
}

export async function publishNext(): Promise<PublishResult> {
  const problem = claimNextUnpublishedProblem();
  if (!problem) {
    return { ok: true, message: "No unpublished problems in queue" };
  }

  const content = buildMessage(problem);
  const webhook = process.env.DISCORD_WEBHOOK_URL ?? "";

  if (!webhook) {
    console.log("[publish-next] Discord dry-run (DISCORD_WEBHOOK_URL unset):");
    console.log(content);
    return {
      ok: true,
      dryRun: true,
      problem: { id: problem.id, slug: problem.slug, title: problem.title },
      message: content,
    };
  }

  try {
    const res = await fetch(`${webhook}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Discord HTTP ${res.status}: ${body.slice(0, 200)}`,
        problem: { id: problem.id, slug: problem.slug, title: problem.title },
      };
    }
    const data = (await res.json()) as { id?: string };
    if (data.id) setDiscordMessageId(problem.id, data.id);
    return {
      ok: true,
      problem: { id: problem.id, slug: problem.slug, title: problem.title },
      message: content,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg,
      problem: { id: problem.id, slug: problem.slug, title: problem.title },
    };
  }
}
