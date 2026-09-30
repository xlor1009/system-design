"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: fd.get("password"),
        displayName: fd.get("displayName"),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="login-hero">
      <div className="status-badge">
        <span className="dot" aria-hidden />
        <span>Friends-only study group</span>
      </div>
      <h1 className="hero-title" style={{ maxWidth: "12ch" }}>
        Join the
        <span className="glyph" aria-hidden />
        weekly loop
      </h1>
      <p className="hero-sub">Shared group password + your display name.</p>

      <div className="login-card">
        <h1 style={{ fontSize: "1.35rem" }}>Enter Study Loop</h1>
        <p className="muted" style={{ marginTop: "0.35rem" }}>
          Same password for everyone. Grades stay private.
        </p>
        <form onSubmit={onSubmit}>
          <label htmlFor="password">Group password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            data-testid="password"
          />
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={64}
            autoComplete="nickname"
            data-testid="display-name"
          />
          {error ? <p className="field-error">{error}</p> : null}
          <p style={{ marginTop: "1.35rem" }}>
            <button className="btn" type="submit" disabled={pending} style={{ width: "100%" }}>
              {pending ? "Signing in…" : "Enter"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
