"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminNewPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: fd.get("slug"),
        title: fd.get("title"),
        promptMd: fd.get("promptMd"),
        timeboxMinutes: Number(fd.get("timeboxMinutes")),
        weekOf: fd.get("weekOf"),
        dueAt: new Date(String(fd.get("dueAt"))).toISOString(),
        adminOutlineMd: fd.get("adminOutlineMd") || undefined,
        sourceRoadmapTopic: fd.get("sourceRoadmapTopic") || undefined,
        sourceUrl: fd.get("sourceUrl") || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Create failed");
      return;
    }
    const data = (await res.json()) as { problem: { slug: string } };
    router.push(`/problems/${data.problem.slug}`);
  }

  async function onPublish() {
    setPublishMsg("");
    const secret = prompt("CRON_SECRET");
    if (!secret) return;
    const res = await fetch("/api/cron/publish-next", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    setPublishMsg(JSON.stringify(data, null, 2));
  }

  return (
    <div className="shell-main pad">
      <p className="label-caps">Admin</p>
      <h1 className="page-title">New problem</h1>
      <p className="muted">Create a slug or publish the next curated item to Discord.</p>

      <form onSubmit={onCreate} style={{ maxWidth: 560, marginTop: "1.5rem" }}>
        <label htmlFor="slug">Slug</label>
        <input id="slug" name="slug" required placeholder="topic-2026-w41" />

        <label htmlFor="title">Title</label>
        <input id="title" name="title" required />

        <label htmlFor="weekOf">Week of</label>
        <input id="weekOf" name="weekOf" required placeholder="2026-W41" />

        <label htmlFor="dueAt">Due at</label>
        <input id="dueAt" name="dueAt" type="datetime-local" required />

        <label htmlFor="timeboxMinutes">Timebox (minutes)</label>
        <input
          id="timeboxMinutes"
          name="timeboxMinutes"
          type="number"
          min={15}
          defaultValue={45}
          required
        />

        <label htmlFor="promptMd">Prompt (markdown)</label>
        <textarea id="promptMd" name="promptMd" required />

        <label htmlFor="adminOutlineMd">Admin outline (private)</label>
        <textarea id="adminOutlineMd" name="adminOutlineMd" />

        <label htmlFor="sourceRoadmapTopic">Roadmap topic</label>
        <input id="sourceRoadmapTopic" name="sourceRoadmapTopic" />

        <label htmlFor="sourceUrl">Source URL (systemdesign.io)</label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          placeholder="https://systemdesign.io/question/..."
        />

        {error ? <p className="field-error">{error}</p> : null}
        <p style={{ marginTop: "1.25rem" }}>
          <button className="btn dark" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create"}
          </button>
        </p>
      </form>

      <h2 className="page-title" style={{ fontSize: "1.25rem", marginTop: "3rem" }}>
        Publish next to Discord
      </h2>
      <button
        type="button"
        className="btn secondary on-light"
        onClick={onPublish}
        data-testid="admin-publish"
      >
        Publish next
      </button>
      {publishMsg ? (
        <pre className="prompt" style={{ marginTop: "1rem" }}>
          {publishMsg}
        </pre>
      ) : null}
    </div>
  );
}
