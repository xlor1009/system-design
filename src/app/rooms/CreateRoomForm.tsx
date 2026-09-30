"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name") }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not create room");
      return;
    }
    const data = (await res.json()) as { invitePath: string };
    router.push(data.invitePath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, marginTop: "1.25rem" }}>
      <label htmlFor="name">Room name</label>
      <input
        id="name"
        name="name"
        required
        maxLength={80}
        placeholder="Sunday systems crew"
        data-testid="room-name"
      />
      {error ? <p className="field-error">{error}</p> : null}
      <p style={{ marginTop: "1.15rem" }}>
        <button className="btn dark" type="submit" disabled={pending} data-testid="create-room">
          {pending ? "Creating…" : "Create room"}
        </button>
      </p>
    </form>
  );
}
